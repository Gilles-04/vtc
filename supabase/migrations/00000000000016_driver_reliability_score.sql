-- Critère de fiabilité du matching (docs/08-matching.md §Étape 1),
-- explicitement documenté comme non implémenté au MVP jusqu'ici — demandé
-- explicitement par le porteur du projet le 4 septembre 2026.
--
-- Deux colonnes agrégées sur `drivers`, recalculées périodiquement (pas en
-- temps réel à chaque `ride_offers`/`rides` — trop de recalculs sur le
-- chemin chaud du dispatch pour un gain de fraîcheur qui n'a pas besoin
-- d'être seconde-près) via `pg_cron`, même schéma que
-- `expire_subscriptions`/`cleanup_rate_limits` (migration 2). Fenêtre
-- glissante de 30 jours (« récent », pas tout l'historique du chauffeur —
-- un chauffeur qui s'est amélioré ne doit pas rester pénalisé
-- indéfiniment par une mauvaise période ancienne).
--
-- `acceptance_rate` : part des offres résolues (`accepted`/`rejected`/
-- `expired` — jamais `pending`, pas encore décidées) que le chauffeur a
-- acceptées. `cancellation_rate` : part des courses que ce chauffeur a
-- effectivement acceptées (`rides.driver_id` renseigné, donc au moins une
-- fois `accepted`) qu'il a lui-même annulées après coup
-- (`status = 'cancelled_by_driver'`, via `cancel_ride` — voir migration 2).
-- Une annulation par le passager après acceptation du chauffeur ne compte
-- jamais contre le chauffeur.
--
-- `null` (pas 0) quand aucune donnée récente n'existe — un chauffeur sans
-- historique récent ne doit pas être classé comme le pire candidat possible
-- par manque de données, `dispatch_next_offer` traite `null` comme neutre/
-- favorable (`coalesce`).
alter table public.drivers
  add column acceptance_rate numeric(5, 2),
  add column cancellation_rate numeric(5, 2);

create or replace function public.recompute_driver_reliability()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _window interval := interval '30 days';
  _updated integer;
begin
  with acceptance as (
    select driver_id,
           round(100.0 * count(*) filter (where status = 'accepted') / count(*), 2) as rate
    from public.ride_offers
    where sent_at > now() - _window
      and status in ('accepted', 'rejected', 'expired')
    group by driver_id
  ),
  cancellation as (
    select driver_id,
           round(100.0 * count(*) filter (where status = 'cancelled_by_driver') / count(*), 2) as rate
    from public.rides
    where driver_id is not null
      and requested_at > now() - _window
    group by driver_id
  )
  update public.drivers d
  set acceptance_rate = a.rate,
      cancellation_rate = c.rate
  from (select id from public.drivers) ids
  left join acceptance a on a.driver_id = ids.id
  left join cancellation c on c.driver_id = ids.id
  where d.id = ids.id;

  get diagnostics _updated = row_count;
  return _updated;
end;
$$;

revoke execute on function public.recompute_driver_reliability() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('recompute-driver-reliability', '*/15 * * * *', $cron$select public.recompute_driver_reliability();$cron$);
  end if;
end;
$$;

-- `dispatch_next_offer` (migration 2) : classement inchangé pour l'étape 0
-- (filtrage strict) — seul l'ORDER BY de l'étape 1 gagne deux critères,
-- insérés juste après la distance (dominante) et avant la note : un
-- chauffeur peu fiable fait perdre du temps au passager par construction
-- (offre acceptée puis annulée, ou jamais répondue jusqu'à expiration) —
-- un risque plus direct pour l'issue du matching qu'une note plus basse.
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
    order by
      extensions.ST_Distance(d.current_location, _ride.pickup_location) asc,
      coalesce(d.cancellation_rate, 0) asc,
      coalesce(d.acceptance_rate, 100) desc,
      d.rating_avg desc,
      d.last_location_at asc
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

revoke execute on function public.dispatch_next_offer(uuid) from public, anon, authenticated;
grant execute on function public.dispatch_next_offer(uuid) to service_role;
