-- Logique métier de la plateforme VTC : fonctions RPC (SECURITY DEFINER),
-- triggers automatiques, tâches planifiées. Voir docs/07-api.md pour le
-- contrat de chaque fonction, docs/08-matching.md pour l'algorithme de
-- dispatch, docs/09-abonnement.md pour le cycle de l'abonnement.
--
-- Convention de nommage : une fonction préfixée `admin_` vérifie elle-même
-- `private.has_admin_role(...)` en première ligne — jamais de contrôle
-- d'accès délégué à l'appelant. Une fonction sans grant `authenticated` en
-- fin de fichier n'est PAS un point d'API : elle n'est appelée que par
-- d'autres fonctions serveur, par `pg_cron`, ou par une Edge
-- Function/le worker de matching via la clé de service.

-- ========================================================================
-- ASSISTANCE : suspension, anti-fraude
-- ========================================================================

create or replace function private.assert_not_suspended()
returns void
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and is_suspended = true) then
    raise exception 'account_suspended';
  end if;
end;
$$;

-- Limitation de débit à fenêtre fixe, réutilisable par toute action
-- sensible (OTP, création de course, achat d'abonnement...). Lève une
-- exception au-delà du seuil plutôt que d'échouer silencieusement — plus
-- simple à traiter côté client (message d'erreur explicite).
create or replace function private.enforce_rate_limit(_key text, _max_count integer, _window_seconds integer)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _window_start timestamptz;
  _count integer;
begin
  _window_start := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);

  insert into public.rate_limit_counters (key, window_start, count)
  values (_key, _window_start, 1)
  on conflict (key, window_start) do update set count = public.rate_limit_counters.count + 1
  returning count into _count;

  if _count > _max_count then
    raise exception 'rate_limit_exceeded' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.cleanup_rate_limits()
returns void
language sql
security definer
set search_path = public, extensions
as $$
  delete from public.rate_limit_counters where window_start < now() - interval '1 day';
$$;

-- ========================================================================
-- TRIGGERS AUTOMATIQUES
-- ========================================================================

-- Historique complet des changements de statut d'une course — jamais écrit
-- à la main, toujours dérivé de l'état réel de `rides`.
create or replace function public.log_ride_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ride_status_history (ride_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.ride_status_history (ride_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger rides_status_history
  after insert or update on public.rides
  for each row execute function public.log_ride_status_change();

-- Agrège chaque nouvelle note sur le compteur de réputation de la personne
-- notée (passager -> agrège sur `drivers`, chauffeur -> agrège sur
-- `passengers`), en une seule transaction avec l'insertion de l'avis.
create or replace function public.apply_rating_to_aggregate()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.rater_role = 'passenger' then
    update public.drivers
    set rating_count = rating_count + 1,
        rating_avg = round((((rating_avg * rating_count) + new.rating) / (rating_count + 1))::numeric, 1)
    where id = new.ratee_id;
  else
    update public.passengers
    set rating_count = rating_count + 1,
        rating_avg = round((((rating_avg * rating_count) + new.rating) / (rating_count + 1))::numeric, 1)
    where id = new.ratee_id;
  end if;
  return new;
end;
$$;

create trigger ratings_apply_aggregate
  after insert on public.ratings
  for each row execute function public.apply_rating_to_aggregate();

create or replace function public.increment_promotion_redemptions()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.promotions set redemptions_count = redemptions_count + 1 where id = new.promotion_id;
  return new;
end;
$$;

create trigger promotion_redemptions_increment
  after insert on public.promotion_redemptions
  for each row execute function public.increment_promotion_redemptions();

-- Anti-fraude : un même appareil déclaré sur plusieurs comptes distincts
-- déclenche un signalement pour revue humaine — jamais de blocage
-- automatique silencieux.
create or replace function public.flag_device_duplicate()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _other_users integer;
begin
  select count(distinct user_id) into _other_users
  from public.device_fingerprints
  where device_id = new.device_id and user_id <> new.user_id;

  if _other_users > 0 then
    insert into public.fraud_flags (subject_type, subject_id, reason, severity, metadata)
    values (
      'device', new.device_id,
      'Appareil partagé par plusieurs comptes',
      case when _other_users >= 3 then 'high'::public.fraud_severity when _other_users >= 1 then 'medium'::public.fraud_severity else 'low'::public.fraud_severity end,
      jsonb_build_object('new_user_id', new.user_id, 'linked_user_count', _other_users + 1)
    );
  end if;
  return new;
end;
$$;

create trigger device_fingerprints_flag_duplicate
  after insert on public.device_fingerprints
  for each row execute function public.flag_device_duplicate();

-- Une alerte SOS notifie immédiatement tout le staff support/admin (relayé
-- en direct côté dashboard via Realtime sur `notifications`).
create or replace function public.notify_admins_on_sos()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.notifications (user_id, type, title, body, data)
  select ar.user_id, 'sos_alert', 'Alerte SOS', 'Une alerte SOS vient d''être déclenchée.',
         jsonb_build_object('sos_id', new.id, 'ride_id', new.ride_id)
  from public.admin_roles ar
  where ar.role in ('super_admin', 'admin', 'support');
  return new;
end;
$$;

create trigger sos_alerts_notify_admins
  after insert on public.sos_alerts
  for each row execute function public.notify_admins_on_sos();

-- ========================================================================
-- CHAUFFEUR : KYC, véhicule, disponibilité, position
-- ========================================================================

create or replace function public.submit_driver_application(
  _category public.driver_category,
  _city text,
  _vehicle_brand text,
  _vehicle_model text,
  _vehicle_color text,
  _vehicle_plate text,
  _vehicle_year integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _uid uuid := auth.uid();
begin
  perform private.assert_not_suspended();
  if _uid is null then
    raise exception 'not_authenticated';
  end if;

  -- La catégorie choisie à l'inscription est définitive au MVP (changer de
  -- catégorie voudrait dire un autre véhicule, un autre abonnement, une
  -- autre tarification — pas prévu comme un simple changement de champ) :
  -- ignorée sur un conflit, jamais réécrite par une resoumission.
  insert into public.drivers (id, category, city) values (_uid, _category, _city)
  on conflict (id) do update set city = excluded.city
  where public.drivers.status in ('pending_documents', 'rejected');

  insert into public.user_roles (user_id, role) values (_uid, 'driver')
  on conflict do nothing;

  insert into public.vehicles (driver_id, brand, model, color, plate_number, year)
  values (_uid, _vehicle_brand, _vehicle_model, _vehicle_color, _vehicle_plate, _vehicle_year)
  on conflict (driver_id) do update set
    brand = excluded.brand, model = excluded.model, color = excluded.color,
    plate_number = excluded.plate_number, year = excluded.year;

  update public.drivers set status = 'pending_review' where id = _uid and status = 'pending_documents';

  return _uid;
end;
$$;

create or replace function public.admin_review_driver_document(_document_id uuid, _decision public.doc_status, _reason text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _driver uuid;
begin
  if not private.has_admin_role(array['super_admin', 'admin']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;
  if _decision not in ('approved', 'rejected') then
    raise exception 'invalid_decision';
  end if;

  update public.driver_documents
  set status = _decision,
      rejection_reason = case when _decision = 'rejected' then _reason else null end,
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = _document_id
  returning driver_id into _driver;

  if _driver is null then
    raise exception 'document_not_found';
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'review_driver_document', 'driver_documents', _document_id::text, jsonb_build_object('decision', _decision, 'reason', _reason));
end;
$$;

create or replace function public.admin_decide_driver_application(_driver_id uuid, _decision public.driver_status, _reason text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not private.has_admin_role(array['super_admin', 'admin']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;
  if _decision not in ('approved', 'rejected') then
    raise exception 'invalid_decision';
  end if;

  update public.drivers set status = _decision where id = _driver_id;
  if not found then
    raise exception 'driver_not_found';
  end if;

  if _decision = 'rejected' then
    update public.drivers set is_available = false where id = _driver_id;
  end if;

  insert into public.notifications (user_id, type, title, body)
  values (
    _driver_id, 'driver_application_decision',
    case when _decision = 'approved' then 'Dossier validé' else 'Dossier refusé' end,
    case when _decision = 'approved' then 'Votre dossier chauffeur est validé, vous pouvez acheter un abonnement.'
         else coalesce(_reason, 'Votre dossier a été refusé.') end
  );

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'decide_driver_application', 'drivers', _driver_id::text, jsonb_build_object('decision', _decision, 'reason', _reason));
end;
$$;

-- Redondant à dessein avec le GRANT UPDATE direct sur `drivers.is_available`
-- (migration 1) : le matching revérifie de toute façon l'abonnement actif à
-- chaque dispatch, donc les deux chemins sont sûrs. Cette fonction offre
-- juste un message d'erreur explicite côté client plutôt qu'un échec RLS
-- muet.
create or replace function public.set_driver_availability(_is_available boolean)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _uid uuid := auth.uid();
  _status public.driver_status;
begin
  perform private.assert_not_suspended();
  select status into _status from public.drivers where id = _uid;
  if _status is null then
    raise exception 'not_a_driver';
  end if;
  if _is_available and _status <> 'approved' then
    raise exception 'driver_not_approved';
  end if;
  if _is_available and not exists (
    select 1 from public.subscriptions where driver_id = _uid and status = 'active' and expires_at > now()
  ) then
    raise exception 'no_active_subscription';
  end if;

  update public.drivers set is_available = _is_available where id = _uid;
end;
$$;

-- Écrit la position courante (cache rapide sur `drivers`) et son historique
-- (`driver_locations`), et détecte au passage un déplacement implausible
-- (signal d'usurpation GPS) sans jamais bloquer la mise à jour elle-même —
-- seulement un signalement pour revue.
create or replace function public.update_driver_location(
  _lat double precision,
  _lng double precision,
  _accuracy_meters numeric default null,
  _ride_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _uid uuid := auth.uid();
  _point extensions.geography;
  _prev_location extensions.geography;
  _prev_at timestamptz;
  _seconds double precision;
  _distance_m double precision;
  _speed_kmh double precision;
begin
  if _uid is null or not exists (select 1 from public.drivers where id = _uid) then
    raise exception 'not_a_driver';
  end if;

  _point := extensions.ST_SetSRID(extensions.ST_MakePoint(_lng, _lat), 4326)::extensions.geography;

  select current_location, last_location_at into _prev_location, _prev_at
  from public.drivers where id = _uid;

  if _prev_location is not null and _prev_at is not null then
    _seconds := extract(epoch from (now() - _prev_at));
    if _seconds > 0 and _seconds < 300 then
      _distance_m := extensions.ST_Distance(_prev_location, _point);
      _speed_kmh := (_distance_m / _seconds) * 3.6;
      if _speed_kmh > 150 then
        insert into public.fraud_flags (subject_type, subject_id, reason, severity, metadata)
        values (
          'driver', _uid::text, 'Déplacement GPS implausible',
          case when _speed_kmh > 400 then 'high'::public.fraud_severity else 'medium'::public.fraud_severity end,
          jsonb_build_object('speed_kmh', round(_speed_kmh::numeric, 1), 'distance_m', round(_distance_m::numeric, 1), 'seconds', round(_seconds::numeric, 1))
        );
      end if;
    end if;
  end if;

  update public.drivers set current_location = _point, last_location_at = now() where id = _uid;

  insert into public.driver_locations (driver_id, ride_id, location, accuracy_meters)
  values (_uid, _ride_id, _point, _accuracy_meters);
end;
$$;

-- ========================================================================
-- TARIFICATION
-- ========================================================================

create or replace function public.estimate_ride_fare(_distance_km numeric, _duration_min numeric, _category public.driver_category, _zone_id uuid default null)
returns table (pricing_rule_id uuid, fare_fcfa integer, is_night boolean)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  _rule record;
  _is_night boolean := false;
  _fare numeric;
begin
  select * into _rule
  from public.pricing_rules
  where category = _category
    and effective_from <= now()
    and (zone_id = _zone_id or zone_id is null)
  order by (zone_id is not null) desc, effective_from desc
  limit 1;

  if _rule is null then
    raise exception 'no_pricing_rule_configured';
  end if;

  if _zone_id is not null then
    select (current_time >= z.night_start_time or current_time < z.night_end_time) into _is_night
    from public.zones z where z.id = _zone_id;
  end if;

  _fare := _rule.base_fare_fcfa
           + (_distance_km * _rule.price_per_km_fcfa)
           + (_duration_min * _rule.price_per_min_fcfa);

  if coalesce(_is_night, false) then
    _fare := _fare * (1 + _rule.night_multiplier_percent / 100.0);
  end if;

  _fare := greatest(_fare, _rule.minimum_fare_fcfa);

  return query select _rule.id, round(_fare)::integer, coalesce(_is_night, false);
end;
$$;

-- ========================================================================
-- COURSES & MATCHING
-- ========================================================================

create or replace function public.create_ride_request(
  _category public.driver_category,
  _pickup_lat double precision, _pickup_lng double precision, _pickup_address text,
  _dropoff_lat double precision, _dropoff_lng double precision, _dropoff_address text,
  _distance_km numeric, _duration_min numeric,
  _payment_method public.payment_method_type,
  _zone_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _uid uuid := auth.uid();
  _ride_id uuid;
  _estimate record;
begin
  perform private.assert_not_suspended();
  if _uid is null then
    raise exception 'not_authenticated';
  end if;

  perform private.enforce_rate_limit('create_ride:' || _uid::text, 5, 300);

  if exists (
    select 1 from public.rides
    where passenger_id = _uid
      and status in ('requested', 'searching', 'accepted', 'driver_arriving', 'driver_arrived', 'in_progress')
  ) then
    raise exception 'ride_already_in_progress';
  end if;

  select * into _estimate from public.estimate_ride_fare(_distance_km, _duration_min, _category, _zone_id);

  insert into public.rides (
    passenger_id, category, status, pickup_location, pickup_address, dropoff_location, dropoff_address,
    zone_id, pricing_rule_id, estimated_distance_km, estimated_duration_min, estimated_fare_fcfa, payment_method
  ) values (
    _uid, _category, 'searching',
    extensions.ST_SetSRID(extensions.ST_MakePoint(_pickup_lng, _pickup_lat), 4326)::extensions.geography, _pickup_address,
    extensions.ST_SetSRID(extensions.ST_MakePoint(_dropoff_lng, _dropoff_lat), 4326)::extensions.geography, _dropoff_address,
    _zone_id, _estimate.pricing_rule_id, _distance_km, _duration_min, _estimate.fare_fcfa, _payment_method
  ) returning id into _ride_id;

  perform public.dispatch_next_offer(_ride_id);

  return _ride_id;
end;
$$;

-- Cœur de l'algorithme (docs/08-matching.md) : filtre les candidats
-- (approuvé + disponible + position fraîche + abonnement actif + pas déjà
-- en course + jamais sollicité pour CETTE course), classe par distance
-- puis note, envoie une offre au premier, élargit le rayon si personne à
-- proximité. Appelée à la création de la course, après un refus, et par le
-- worker après expiration — jamais directement par le client.
create or replace function public.dispatch_next_offer(_ride_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _ride record;
  _candidate_id uuid;
  _next_rank integer;
  _radius_m integer;
  _excluded uuid[];
begin
  select * into _ride from public.rides where id = _ride_id for update;
  if _ride is null or _ride.status <> 'searching' then
    return false;
  end if;

  select array_agg(driver_id) into _excluded from public.ride_offers where ride_id = _ride_id;
  select coalesce(max(rank), 0) + 1 into _next_rank from public.ride_offers where ride_id = _ride_id;

  foreach _radius_m in array array[3000, 5000, 8000] loop
    select d.id into _candidate_id
    from public.drivers d
    where d.status = 'approved'
      and d.category = _ride.category
      and d.is_available = true
      and d.last_location_at > now() - interval '2 minutes'
      and (_excluded is null or d.id <> all (_excluded))
      and exists (select 1 from public.subscriptions s where s.driver_id = d.id and s.status = 'active' and s.expires_at > now())
      and not exists (
        select 1 from public.rides r2
        where r2.driver_id = d.id and r2.status in ('accepted', 'driver_arriving', 'driver_arrived', 'in_progress')
      )
      and extensions.ST_DWithin(d.current_location, _ride.pickup_location, _radius_m)
    order by extensions.ST_Distance(d.current_location, _ride.pickup_location) asc, d.rating_avg desc, d.last_location_at asc
    limit 1;

    exit when _candidate_id is not null;
  end loop;

  if _candidate_id is null then
    update public.rides
    set status = 'cancelled_by_system', cancelled_at = now(), cancelled_by = 'system',
        cancellation_reason = 'no_drivers_available'
    where id = _ride_id;
    insert into public.notifications (user_id, type, title, body)
    values (_ride.passenger_id, 'ride_cancelled_no_drivers', 'Aucun chauffeur disponible', 'Aucun chauffeur n''est disponible pour le moment. Réessayez dans quelques instants.');
    return false;
  end if;

  insert into public.ride_offers (ride_id, driver_id, rank, expires_at)
  values (_ride_id, _candidate_id, _next_rank, now() + interval '15 seconds');

  insert into public.notifications (user_id, type, title, body, data)
  values (_candidate_id, 'new_ride_offer', 'Nouvelle demande de course', 'Une course vous attend à proximité.', jsonb_build_object('ride_id', _ride_id));

  return true;
end;
$$;

create or replace function public.respond_to_ride_offer(_offer_id uuid, _accept boolean)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _uid uuid := auth.uid();
  _offer record;
begin
  select * into _offer from public.ride_offers where id = _offer_id and driver_id = _uid for update;
  if _offer is null then
    raise exception 'offer_not_found';
  end if;
  if _offer.status <> 'pending' or _offer.expires_at <= now() then
    raise exception 'offer_no_longer_available';
  end if;

  if _accept then
    update public.ride_offers set status = 'accepted', responded_at = now() where id = _offer_id;

    update public.rides set status = 'accepted', driver_id = _uid, matched_at = now()
    where id = _offer.ride_id and status = 'searching';

    if not found then
      update public.ride_offers set status = 'expired' where id = _offer_id;
      raise exception 'ride_already_assigned';
    end if;

    update public.ride_offers set status = 'expired'
    where ride_id = _offer.ride_id and id <> _offer_id and status = 'pending';

    insert into public.notifications (user_id, type, title, body, data)
    select passenger_id, 'ride_accepted', 'Chauffeur trouvé', 'Un chauffeur a accepté votre course.', jsonb_build_object('ride_id', id)
    from public.rides where id = _offer.ride_id;
  else
    update public.ride_offers set status = 'rejected', responded_at = now() where id = _offer_id;
    perform public.dispatch_next_offer(_offer.ride_id);
  end if;
end;
$$;

-- Balayage périodique (appelé toutes les ~5s par le worker de matching —
-- `pg_cron` ne descend pas sous la minute, trop lent pour un délai d'offre
-- de 15s, voir services/matching-worker/README.md) : expire les offres
-- dépassées et relance le dispatch pour chacune.
create or replace function public.expire_ride_offers_and_dispatch()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _rec record;
  _count integer := 0;
begin
  for _rec in
    select id, ride_id from public.ride_offers
    where status = 'pending' and expires_at <= now()
    for update skip locked
  loop
    update public.ride_offers set status = 'expired' where id = _rec.id;
    perform public.dispatch_next_offer(_rec.ride_id);
    _count := _count + 1;
  end loop;
  return _count;
end;
$$;

create or replace function public.mark_driver_arrived(_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.rides set status = 'driver_arrived', driver_arrived_at = now()
  where id = _ride_id and driver_id = auth.uid() and status in ('accepted', 'driver_arriving');
  if not found then
    raise exception 'invalid_ride_state';
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  select passenger_id, 'driver_arrived', 'Votre chauffeur est arrivé', 'Le chauffeur vous attend au point de départ.', jsonb_build_object('ride_id', id)
  from public.rides where id = _ride_id;
end;
$$;

create or replace function public.start_ride(_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.rides set status = 'in_progress', started_at = now()
  where id = _ride_id and driver_id = auth.uid() and status = 'driver_arrived';
  if not found then
    raise exception 'invalid_ride_state';
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  select passenger_id, 'ride_started', 'Course démarrée', 'Votre course a démarré.', jsonb_build_object('ride_id', id)
  from public.rides where id = _ride_id;
end;
$$;

-- RÈGLE ABSOLUE (voir docs/01-architecture-fonctionnelle.md et CLAUDE.md du
-- dépôt) : frais de service = 2,5 % du prix final de la course, calculés
-- une seule fois ici, jamais recalculés ensuite. Le paiement (cash/Mobile
-- Money) se fait en direct passager -> chauffeur (voir docs/10-paiements.md) ;
-- `_payment_confirmed` reflète la confirmation du chauffeur à la fin de la
-- course (même geste que "fin signalée + paiement confirmé" dans le cycle
-- de vie documenté) — ce n'est pas la plateforme qui encaisse. Facture et
-- créance de frais de service ne sont générées (trigger ci-dessous) que si
-- le paiement est confirmé ; sinon la course reste `completed` avec
-- `payment_status = 'failed'`, à régulariser via le support.
create or replace function public.complete_ride(
  _ride_id uuid, _final_distance_km numeric, _final_duration_min numeric,
  _payment_confirmed boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _ride record;
  _estimate record;
  _platform_fee integer;
  _driver_amount integer;
begin
  select * into _ride from public.rides where id = _ride_id and driver_id = auth.uid() and status = 'in_progress' for update;
  if _ride is null then
    raise exception 'invalid_ride_state';
  end if;

  select * into _estimate from public.estimate_ride_fare(_final_distance_km, _final_duration_min, _ride.category, _ride.zone_id);

  if _payment_confirmed then
    _platform_fee := round(_estimate.fare_fcfa * 0.025);
    _driver_amount := _estimate.fare_fcfa - _platform_fee;
  end if;

  update public.rides
  set status = 'completed', completed_at = now(),
      final_distance_km = _final_distance_km, final_duration_min = _final_duration_min,
      final_fare_fcfa = _estimate.fare_fcfa,
      payment_status = case when _payment_confirmed then 'success'::public.payment_status else 'failed'::public.payment_status end,
      platform_fee_fcfa = _platform_fee, driver_amount_fcfa = _driver_amount
  where id = _ride_id;

  update public.drivers set total_rides = total_rides + 1 where id = _ride.driver_id;
  update public.passengers set total_rides = total_rides + 1 where id = _ride.passenger_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (_ride.passenger_id, 'ride_completed', 'Course terminée', 'Votre course est terminée.', jsonb_build_object('ride_id', _ride_id));

  return _estimate.fare_fcfa;
end;
$$;

-- Facturation automatique (docs/01-architecture-fonctionnelle.md §Cycle de
-- vie) : dès qu'une course passe à la fois par 'completed' et
-- payment_status = 'success', une facture est émise, jamais à la main.
-- `on conflict (ride_id) do nothing` protège contre un déclenchement
-- redondant (ex. une future correction de payment_status qui repasserait
-- par 'success' sans repasser par 'completed').
create or replace function public.generate_invoice_on_ride_success()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.status = 'completed' and new.payment_status = 'success' and new.driver_id is not null then
    insert into public.invoices (
      ride_id, passenger_id, driver_id,
      transport_amount_fcfa, platform_fee_fcfa, total_fcfa, payment_method
    ) values (
      new.id, new.passenger_id, new.driver_id,
      coalesce(new.driver_amount_fcfa, 0), coalesce(new.platform_fee_fcfa, 0), coalesce(new.final_fare_fcfa, 0), new.payment_method
    )
    on conflict (ride_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger rides_generate_invoice
  after update on public.rides
  for each row execute function public.generate_invoice_on_ride_success();

create or replace function public.cancel_ride(_ride_id uuid, _reason text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _uid uuid := auth.uid();
  _ride record;
  _by public.cancelled_by_type;
  _notify_user uuid;
begin
  select * into _ride from public.rides where id = _ride_id for update;
  if _ride is null then
    raise exception 'ride_not_found';
  end if;

  if _ride.passenger_id = _uid then
    _by := 'passenger';
  elsif _ride.driver_id = _uid then
    _by := 'driver';
  else
    raise exception 'not_authorized';
  end if;

  if _ride.status not in ('searching', 'accepted', 'driver_arriving', 'driver_arrived') then
    raise exception 'ride_not_cancellable';
  end if;

  update public.rides
  set status = case when _by = 'passenger' then 'cancelled_by_passenger'::public.ride_status else 'cancelled_by_driver'::public.ride_status end,
      cancelled_at = now(), cancelled_by = _by, cancellation_reason = _reason
  where id = _ride_id;

  update public.ride_offers set status = 'expired' where ride_id = _ride_id and status = 'pending';

  _notify_user := case when _by = 'passenger' then _ride.driver_id else _ride.passenger_id end;
  if _notify_user is not null then
    insert into public.notifications (user_id, type, title, body, data)
    values (_notify_user, 'ride_cancelled', 'Course annulée', coalesce(_reason, 'La course a été annulée.'), jsonb_build_object('ride_id', _ride_id));
  end if;
end;
$$;

-- ========================================================================
-- ABONNEMENT & PAIEMENT
-- ========================================================================

create or replace function public.validate_promo_code(_code text)
returns table (valid boolean, discount_type public.promotion_discount_type, discount_value integer, message text)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  _promo record;
  _uid uuid := auth.uid();
begin
  select * into _promo from public.promotions where code = upper(_code) and is_active = true;

  if _promo is null then
    return query select false, null::public.promotion_discount_type, null::integer, 'Code invalide';
  elsif _promo.valid_to is not null and _promo.valid_to < now() then
    return query select false, null::public.promotion_discount_type, null::integer, 'Code expiré';
  elsif _promo.max_redemptions is not null and _promo.redemptions_count >= _promo.max_redemptions then
    return query select false, null::public.promotion_discount_type, null::integer, 'Code épuisé';
  elsif exists (select 1 from public.promotion_redemptions where promotion_id = _promo.id and user_id = _uid) then
    return query select false, null::public.promotion_discount_type, null::integer, 'Code déjà utilisé';
  else
    return query select true, _promo.discount_type, _promo.discount_value, 'Code valide';
  end if;
end;
$$;

create or replace function public.purchase_subscription(_plan_code text, _provider public.payment_provider, _promo_code text default null)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _uid uuid := auth.uid();
  _driver_category public.driver_category;
  _plan record;
  _promo record;
  _promo_applied boolean := false;
  _amount integer;
  _payment_id uuid;
begin
  perform private.assert_not_suspended();
  select category into _driver_category from public.drivers where id = _uid;
  if _uid is null or _driver_category is null then
    raise exception 'not_a_driver';
  end if;
  perform private.enforce_rate_limit('purchase_subscription:' || _uid::text, 10, 3600);

  select * into _plan from public.subscription_plans where code = _plan_code and is_active = true;
  if _plan is null then
    raise exception 'invalid_plan';
  end if;
  -- Un chauffeur voiture ne doit jamais pouvoir payer un plan moto (et
  -- inversement) — les deux revenus d'abonnement doivent rester séparés par
  -- construction, pas seulement par convention côté client.
  if _plan.category <> _driver_category then
    raise exception 'plan_category_mismatch';
  end if;

  _amount := _plan.price_fcfa;

  if _promo_code is not null then
    select p.* into _promo from public.promotions p
    where p.code = upper(_promo_code) and p.is_active = true
      and (p.valid_to is null or p.valid_to > now())
      and (p.max_redemptions is null or p.redemptions_count < p.max_redemptions)
      and p.applies_to = 'subscription'
      and not exists (select 1 from public.promotion_redemptions pr where pr.promotion_id = p.id and pr.user_id = _uid);

    if found then
      _promo_applied := true;
      if _promo.discount_type = 'percent' then
        _amount := round(_amount * (1 - _promo.discount_value / 100.0));
      else
        _amount := greatest(_amount - _promo.discount_value, 0);
      end if;
    end if;
  end if;

  insert into public.payments (user_id, purpose, amount_fcfa, provider, status, metadata)
  values (_uid, 'driver_subscription', _amount, _provider, 'pending', jsonb_build_object('plan_id', _plan.id, 'plan_code', _plan.code))
  returning id into _payment_id;

  if _promo_applied then
    insert into public.promotion_redemptions (promotion_id, user_id, payment_id) values (_promo.id, _uid, _payment_id);
  end if;

  return _payment_id;
end;
$$;

-- Confirme un paiement d'abonnement — jamais appelée directement par un
-- client : uniquement par la fonction admin manuelle ci-dessous, ou par
-- l'Edge Function de webhook Mobile Money (clé de service) une fois le
-- paiement re-vérifié auprès du fournisseur. Idempotente : rejouer un
-- webhook déjà traité ne double pas l'abonnement.
create or replace function public.confirm_subscription_payment(_payment_id uuid, _provider_ref text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _payment record;
  _plan_id uuid;
  _plan record;
  _driver uuid;
  _current_expiry timestamptz;
  _new_start timestamptz;
  _new_expiry timestamptz;
begin
  select * into _payment from public.payments where id = _payment_id for update;
  if _payment is null then
    raise exception 'payment_not_found';
  end if;
  if _payment.status = 'success' then
    return;
  end if;
  if _payment.purpose <> 'driver_subscription' then
    raise exception 'unexpected_payment_purpose';
  end if;

  _plan_id := (_payment.metadata ->> 'plan_id')::uuid;
  select * into _plan from public.subscription_plans where id = _plan_id;
  if _plan is null then
    raise exception 'plan_not_found';
  end if;

  _driver := _payment.user_id;

  update public.payments set status = 'success', provider_ref = _provider_ref, confirmed_at = now() where id = _payment_id;

  select expires_at into _current_expiry from public.subscriptions where driver_id = _driver and status = 'active';

  _new_start := greatest(coalesce(_current_expiry, now()), now());
  _new_expiry := _new_start + make_interval(hours => _plan.duration_hours);

  if _current_expiry is not null then
    update public.subscriptions set expires_at = _new_expiry, plan_id = _plan.id, payment_id = _payment_id
    where driver_id = _driver and status = 'active';
  else
    insert into public.subscriptions (driver_id, plan_id, payment_id, started_at, expires_at, status)
    values (_driver, _plan.id, _payment_id, now(), _new_expiry, 'active');
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  values (_driver, 'subscription_activated', 'Abonnement activé', 'Votre Pass Jour est actif pour 24 heures.', jsonb_build_object('expires_at', _new_expiry));

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'confirm_subscription_payment', 'payments', _payment_id::text, jsonb_build_object('provider_ref', _provider_ref));
end;
$$;

-- Mode de secours tant qu'aucun fournisseur Mobile Money n'est branché
-- (docs/10-paiements.md) : un admin/finance confirme manuellement après
-- vérification (référence SMS opérateur communiquée par le chauffeur).
create or replace function public.admin_manual_payment_confirm(_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not private.has_admin_role(array['super_admin', 'admin', 'finance']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;
  perform public.confirm_subscription_payment(_payment_id, 'manual:' || auth.uid()::text);
end;
$$;

create or replace function public.admin_mark_payment_failed(_payment_id uuid, _reason text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not private.has_admin_role(array['super_admin', 'admin', 'finance']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;
  update public.payments
  set status = 'failed', metadata = metadata || jsonb_build_object('failure_reason', _reason)
  where id = _payment_id and status = 'pending';
  if not found then
    raise exception 'payment_not_found_or_not_pending';
  end if;
end;
$$;

-- Tâche planifiée (`pg_cron`, chaque minute — largement suffisant ici,
-- contrairement au dispatch de course) : expire les abonnements échus et
-- coupe la disponibilité du chauffeur dans la foulée.
create or replace function public.expire_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _driver_ids uuid[];
begin
  with expired as (
    update public.subscriptions
    set status = 'expired'
    where status = 'active' and expires_at <= now()
    returning driver_id
  )
  select array_agg(driver_id) into _driver_ids from expired;

  if _driver_ids is null then
    return 0;
  end if;

  update public.drivers set is_available = false where id = any (_driver_ids);

  insert into public.notifications (user_id, type, title, body)
  select uid, 'subscription_expired', 'Abonnement expiré', 'Votre Pass Jour a expiré. Achetez un nouveau pass pour recevoir des courses.'
  from unnest(_driver_ids) as uid;

  return array_length(_driver_ids, 1);
end;
$$;

-- ========================================================================
-- RÈGLEMENT DES FRAIS DE SERVICE (2,5 % / course, docs/01 §Comment les
-- frais de service sont réellement perçus)
-- ========================================================================
-- Le prix de la course est réglé directement passager -> chauffeur ; les
-- 2,5 % dus par le chauffeur s'accumulent donc sur `rides.platform_fee_fcfa`
-- (course par course, dès que payment_status = 'success') jusqu'à un
-- règlement périodique par lot, décidé et tracé par le staff finance.

-- Regroupe toutes les courses réglées avec succès et non encore rattachées
-- à un règlement, sur la période donnée, en une seule créance à solder.
-- Idempotent par construction : une course déjà rattachée à un règlement
-- (`rides.settlement_id is not null`) n'est jamais reprise dans un second.
create or replace function public.admin_create_settlement(_driver_id uuid, _period_start timestamptz, _period_end timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _settlement_id uuid;
  _rides_count integer;
  _gross integer;
  _fees integer;
begin
  if not private.has_admin_role(array['super_admin', 'admin', 'finance']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;
  if _period_end <= _period_start then
    raise exception 'invalid_period';
  end if;

  select count(*), coalesce(sum(driver_amount_fcfa), 0), coalesce(sum(platform_fee_fcfa), 0)
  into _rides_count, _gross, _fees
  from public.rides
  where driver_id = _driver_id
    and payment_status = 'success'
    and settlement_id is null
    and completed_at >= _period_start and completed_at < _period_end;

  if _rides_count = 0 then
    raise exception 'no_unsettled_rides_in_period';
  end if;

  insert into public.settlements (driver_id, period_start, period_end, rides_count, gross_transport_fcfa, platform_fees_fcfa)
  values (_driver_id, _period_start, _period_end, _rides_count, _gross, _fees)
  returning id into _settlement_id;

  update public.rides
  set settlement_id = _settlement_id
  where driver_id = _driver_id
    and payment_status = 'success'
    and settlement_id is null
    and completed_at >= _period_start and completed_at < _period_end;

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'create_settlement', 'settlements', _settlement_id::text, jsonb_build_object('driver_id', _driver_id, 'rides_count', _rides_count, 'platform_fees_fcfa', _fees));

  return _settlement_id;
end;
$$;

create or replace function public.admin_mark_settlement_paid(_settlement_id uuid, _settlement_method text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not private.has_admin_role(array['super_admin', 'admin', 'finance']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;

  update public.settlements
  set status = 'settled', settled_at = now(), settled_by = auth.uid(), settlement_method = _settlement_method
  where id = _settlement_id and status = 'pending';
  if not found then
    raise exception 'settlement_not_found_or_already_settled';
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'mark_settlement_paid', 'settlements', _settlement_id::text, jsonb_build_object('method', _settlement_method));
end;
$$;

-- ========================================================================
-- SUPPORT
-- ========================================================================

create or replace function public.create_support_ticket(_category public.support_ticket_category, _subject text, _message text, _ride_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _uid uuid := auth.uid();
  _ticket_id uuid;
begin
  perform private.assert_not_suspended();
  if _uid is null then
    raise exception 'not_authenticated';
  end if;
  perform private.enforce_rate_limit('support_ticket:' || _uid::text, 10, 3600);

  insert into public.support_tickets (user_id, category, subject, ride_id)
  values (_uid, _category, _subject, _ride_id)
  returning id into _ticket_id;

  insert into public.support_ticket_messages (ticket_id, sender_id, sender_type, body)
  values (_ticket_id, _uid, 'user', _message);

  return _ticket_id;
end;
$$;

create or replace function public.admin_assign_support_ticket(_ticket_id uuid, _assignee uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;
  update public.support_tickets set assigned_to = _assignee, status = 'pending' where id = _ticket_id;
  if not found then
    raise exception 'ticket_not_found';
  end if;
end;
$$;

create or replace function public.admin_resolve_support_ticket(_ticket_id uuid, _resolution_message text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;

  update public.support_tickets set status = 'resolved', resolved_by = auth.uid(), resolved_at = now() where id = _ticket_id;
  if not found then
    raise exception 'ticket_not_found';
  end if;

  if _resolution_message is not null then
    insert into public.support_ticket_messages (ticket_id, sender_id, sender_type, body)
    values (_ticket_id, auth.uid(), 'staff', _resolution_message);
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id)
  values (auth.uid(), 'resolve_support_ticket', 'support_tickets', _ticket_id::text);
end;
$$;

-- ========================================================================
-- MODÉRATION & CONFIANCE
-- ========================================================================

create or replace function public.admin_suspend_user(_user_id uuid, _reason text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not private.has_admin_role(array['super_admin', 'admin']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;
  update public.profiles set is_suspended = true, suspended_reason = _reason where id = _user_id;
  if not found then
    raise exception 'user_not_found';
  end if;
  update public.drivers set is_available = false where id = _user_id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'suspend_user', 'profiles', _user_id::text, jsonb_build_object('reason', _reason));
end;
$$;

create or replace function public.admin_unsuspend_user(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not private.has_admin_role(array['super_admin', 'admin']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;
  update public.profiles set is_suspended = false, suspended_reason = null where id = _user_id;
  if not found then
    raise exception 'user_not_found';
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id)
  values (auth.uid(), 'unsuspend_user', 'profiles', _user_id::text);
end;
$$;

create or replace function public.admin_resolve_report(_report_id uuid, _status public.report_status, _notes text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;
  update public.reports set status = _status, resolved_by = auth.uid(), resolved_at = now(), resolution_notes = _notes where id = _report_id;
  if not found then
    raise exception 'report_not_found';
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'resolve_report', 'reports', _report_id::text, jsonb_build_object('status', _status));
end;
$$;

create or replace function public.admin_resolve_sos(_sos_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;
  update public.sos_alerts set status = 'resolved', resolved_by = auth.uid(), resolved_at = now() where id = _sos_id;
  if not found then
    raise exception 'sos_not_found';
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id)
  values (auth.uid(), 'resolve_sos', 'sos_alerts', _sos_id::text);
end;
$$;

create or replace function public.admin_resolve_fraud_flag(_flag_id uuid, _status public.fraud_flag_status, _notes text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not private.has_admin_role(array['super_admin', 'admin']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;
  update public.fraud_flags set status = _status, resolved_by = auth.uid(), resolved_at = now(), resolution_notes = _notes where id = _flag_id;
  if not found then
    raise exception 'flag_not_found';
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'resolve_fraud_flag', 'fraud_flags', _flag_id::text, jsonb_build_object('status', _status));
end;
$$;

-- ========================================================================
-- STATISTIQUES ADMIN
-- ========================================================================

create or replace function public.admin_stats_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  _result jsonb;
begin
  if not private.has_admin_role(array['super_admin', 'admin', 'finance']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;

  -- Les deux revenus (abonnement, frais de service) restent séparés dans
  -- chaque bloc ci-dessous — jamais additionnés entre eux — voir CLAUDE.md
  -- §Règle absolue et docs/01-architecture-fonctionnelle.md.
  select jsonb_build_object(
    'rides_today', (select count(*) from public.rides where requested_at >= date_trunc('day', now())),
    'rides_today_car', (select count(*) from public.rides where category = 'car' and requested_at >= date_trunc('day', now())),
    'rides_today_moto', (select count(*) from public.rides where category = 'moto' and requested_at >= date_trunc('day', now())),
    'rides_completed_today', (select count(*) from public.rides where status = 'completed' and completed_at >= date_trunc('day', now())),
    'active_drivers_car', (select count(*) from public.drivers where is_available = true and status = 'approved' and category = 'car'),
    'active_drivers_moto', (select count(*) from public.drivers where is_available = true and status = 'approved' and category = 'moto'),
    'approved_drivers_car', (select count(*) from public.drivers where status = 'approved' and category = 'car'),
    'approved_drivers_moto', (select count(*) from public.drivers where status = 'approved' and category = 'moto'),
    'pending_kyc', (select count(*) from public.drivers where status = 'pending_review'),
    'active_subscriptions_car', (select count(*) from public.subscriptions s join public.subscription_plans p on p.id = s.plan_id where s.status = 'active' and s.expires_at > now() and p.category = 'car'),
    'active_subscriptions_moto', (select count(*) from public.subscriptions s join public.subscription_plans p on p.id = s.plan_id where s.status = 'active' and s.expires_at > now() and p.category = 'moto'),
    'subscription_revenue_today_car_fcfa', (select coalesce(sum(pay.amount_fcfa), 0) from public.payments pay join public.subscription_plans p on p.id = (pay.metadata ->> 'plan_id')::uuid where pay.purpose = 'driver_subscription' and pay.status = 'success' and pay.confirmed_at >= date_trunc('day', now()) and p.category = 'car'),
    'subscription_revenue_today_moto_fcfa', (select coalesce(sum(pay.amount_fcfa), 0) from public.payments pay join public.subscription_plans p on p.id = (pay.metadata ->> 'plan_id')::uuid where pay.purpose = 'driver_subscription' and pay.status = 'success' and pay.confirmed_at >= date_trunc('day', now()) and p.category = 'moto'),
    -- Frais de service (2,5 %/course) : jamais mélangés à l'abonnement
    -- ci-dessus, distincts par catégorie eux aussi.
    'platform_fees_today_car_fcfa', (select coalesce(sum(platform_fee_fcfa), 0) from public.rides where category = 'car' and payment_status = 'success' and completed_at >= date_trunc('day', now())),
    'platform_fees_today_moto_fcfa', (select coalesce(sum(platform_fee_fcfa), 0) from public.rides where category = 'moto' and payment_status = 'success' and completed_at >= date_trunc('day', now())),
    'platform_fees_pending_settlement_fcfa', (select coalesce(sum(platform_fee_fcfa), 0) from public.rides where payment_status = 'success' and settlement_id is null),
    'open_sos', (select count(*) from public.sos_alerts where status = 'open'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'open_support_tickets', (select count(*) from public.support_tickets where status in ('open', 'pending')),
    'open_fraud_flags', (select count(*) from public.fraud_flags where status in ('open', 'reviewing'))
  ) into _result;

  return _result;
end;
$$;

-- ========================================================================
-- GRANTS — surface d'API réellement exposée aux clients authentifiés
-- ========================================================================
-- Par défaut Postgres accorde EXECUTE à PUBLIC sur toute nouvelle fonction
-- (contrairement aux tables, déjà verrouillées en migration 1) — chaque
-- fonction listée ci-dessous est donc explicitement (r)accordée ou
-- retirée, sans compter sur ce défaut.

revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on function private.has_admin_role(public.admin_role[]) to authenticated;

grant execute on function public.submit_driver_application(public.driver_category, text, text, text, text, text, integer) to authenticated;
grant execute on function public.admin_review_driver_document(uuid, public.doc_status, text) to authenticated;
grant execute on function public.admin_decide_driver_application(uuid, public.driver_status, text) to authenticated;
grant execute on function public.set_driver_availability(boolean) to authenticated;
grant execute on function public.update_driver_location(double precision, double precision, numeric, uuid) to authenticated;

grant execute on function public.estimate_ride_fare(numeric, numeric, public.driver_category, uuid) to authenticated;
grant execute on function public.create_ride_request(public.driver_category, double precision, double precision, text, double precision, double precision, text, numeric, numeric, public.payment_method_type, uuid) to authenticated;
grant execute on function public.respond_to_ride_offer(uuid, boolean) to authenticated;
grant execute on function public.mark_driver_arrived(uuid) to authenticated;
grant execute on function public.start_ride(uuid) to authenticated;
grant execute on function public.complete_ride(uuid, numeric, numeric, boolean) to authenticated;
grant execute on function public.cancel_ride(uuid, text) to authenticated;

grant execute on function public.validate_promo_code(text) to authenticated;
grant execute on function public.purchase_subscription(text, public.payment_provider, text) to authenticated;
grant execute on function public.admin_manual_payment_confirm(uuid) to authenticated;
grant execute on function public.admin_mark_payment_failed(uuid, text) to authenticated;
grant execute on function public.admin_create_settlement(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_mark_settlement_paid(uuid, text) to authenticated;

grant execute on function public.create_support_ticket(public.support_ticket_category, text, text, uuid) to authenticated;
grant execute on function public.admin_assign_support_ticket(uuid, uuid) to authenticated;
grant execute on function public.admin_resolve_support_ticket(uuid, text) to authenticated;

grant execute on function public.admin_suspend_user(uuid, text) to authenticated;
grant execute on function public.admin_unsuspend_user(uuid) to authenticated;
grant execute on function public.admin_resolve_report(uuid, public.report_status, text) to authenticated;
grant execute on function public.admin_resolve_sos(uuid) to authenticated;
grant execute on function public.admin_resolve_fraud_flag(uuid, public.fraud_flag_status, text) to authenticated;
grant execute on function public.admin_stats_overview() to authenticated;

-- Internes uniquement : jamais accordées à `authenticated` — appelées par
-- d'autres fonctions serveur, `pg_cron`, ou une Edge Function/le worker via
-- la clé de service (`service_role` bénéficie déjà d'un accès complet côté
-- Supabase, ces grants explicites sont une garantie supplémentaire).
grant execute on function public.dispatch_next_offer(uuid) to service_role;
grant execute on function public.expire_ride_offers_and_dispatch() to service_role;
grant execute on function public.expire_subscriptions() to service_role;
grant execute on function public.confirm_subscription_payment(uuid, text) to service_role;
grant execute on function public.cleanup_rate_limits() to service_role;

-- ========================================================================
-- TÂCHES PLANIFIÉES (pg_cron)
-- ========================================================================
-- Le sweep court des offres de course (15s) est hors de portée de pg_cron
-- (granularité minute) : il est assuré par services/matching-worker, pas
-- ici. pg_cron ne couvre que les tâches à l'échelle de la minute et plus.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-subscriptions', '* * * * *', $cron$select public.expire_subscriptions();$cron$);
    perform cron.schedule('cleanup-rate-limits', '17 3 * * *', $cron$select public.cleanup_rate_limits();$cron$);
  end if;
end;
$$;
