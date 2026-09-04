-- Correctif de la migration 13 : `_ride.passenger_id <> auth.uid()` (et son
-- pendant `driver_id <>`) renvoie NULL, jamais TRUE, quand `auth.uid()` est
-- NULL (appel non authentifié) — et PL/pgSQL traite NULL comme FALSE dans
-- un `if`, donc l'exception `not_authorized` n'était PAS levée dans ce cas.
-- Repéré en vérifiant les grants réels après application de la migration
-- 13 : comme observé pour tout le reste du projet (voir migration 8),
-- `anon` reçoit EXECUTE par défaut à la création de toute fonction
-- `public.*`, y compris ces deux-là — donc ce n'était pas seulement
-- théorique, un appel anonyme portant un `_ride_id` valide aurait pu
-- passer le test. `create_ride_request` (migration 2) évite ce piège avec
-- un `if _uid is null then raise ... end if;` explicite ; ici on utilise
-- `is distinct from`, NULL-safe par construction, pour le même résultat.
--
-- Convention du projet pour les fonctions client (voir migration 8) :
-- l'accès non authentifié est bloqué par une vérification explicite dans
-- le corps de la fonction, pas par un `revoke ... from anon` — `anon`
-- garde son EXECUTE (comme sur `create_ride_request`, `cancel_ride`, etc.),
-- c'est la logique métier qui doit être sûre face à `auth.uid() is null`.

create or replace function public.get_ride_driver_public_info(_ride_id uuid)
returns table (
  full_name text,
  rating_avg numeric,
  vehicle_brand text,
  vehicle_model text,
  vehicle_color text,
  vehicle_plate text
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  _ride record;
begin
  select id, passenger_id, driver_id into _ride from public.rides where id = _ride_id;
  if _ride is null then
    raise exception 'ride_not_found';
  end if;
  if _ride.passenger_id is distinct from auth.uid() and not private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;
  if _ride.driver_id is null then
    return;
  end if;

  return query
  select p.full_name, d.rating_avg, v.brand, v.model, v.color, v.plate_number
  from public.drivers d
  join public.profiles p on p.id = d.id
  left join public.vehicles v on v.driver_id = d.id
  where d.id = _ride.driver_id;
end;
$$;

create or replace function public.get_ride_passenger_public_info(_ride_id uuid)
returns table (full_name text)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  _ride record;
begin
  select id, passenger_id, driver_id into _ride from public.rides where id = _ride_id;
  if _ride is null then
    raise exception 'ride_not_found';
  end if;
  if _ride.driver_id is distinct from auth.uid() and not private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;

  return query select p.full_name from public.profiles p where p.id = _ride.passenger_id;
end;
$$;
