-- Deux RPC manquantes repérées en construisant les écrans « SOS » et
-- « Carte live des courses » (docs/05-ecrans.md, écrans transverses
-- passager/chauffeur et écran admin #10) : le schéma prévoyait déjà tout
-- le nécessaire (RLS `sos_alerts_insert_own` autorise l'insertion directe,
-- voir migration 1) mais un insert direct depuis le client ne convient pas
-- pour la colonne `location` (`geography(Point,4326)`) — jamais fait ainsi
-- ailleurs dans ce projet, toujours construit côté serveur via
-- `ST_MakePoint` (voir `create_ride_request`/`update_driver_location`,
-- migration 2) pour rester cohérent et éviter de dépendre du format exact
-- accepté par PostgREST pour un type géographique.

-- Déclenche une alerte SOS pour l'utilisateur courant (passager ou
-- chauffeur), optionnellement rattachée à une course en cours. Le trigger
-- `notify_admins_on_sos` (migration 1) notifie déjà le staff à l'insertion
-- — rien à faire ici en plus de l'insert.
create or replace function public.trigger_sos(_lat double precision, _lng double precision, _ride_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _uid uuid := auth.uid();
  _sos_id uuid;
begin
  if _uid is null then
    raise exception 'not_authorized';
  end if;
  if _ride_id is not null and not exists (
    select 1 from public.rides where id = _ride_id and (passenger_id = _uid or driver_id = _uid)
  ) then
    raise exception 'not_authorized';
  end if;

  insert into public.sos_alerts (ride_id, triggered_by, location)
  values (_ride_id, _uid, extensions.ST_SetSRID(extensions.ST_MakePoint(_lng, _lat), 4326)::extensions.geography)
  returning id into _sos_id;

  return _sos_id;
end;
$$;

revoke execute on function public.trigger_sos(double precision, double precision, uuid) from public, anon;
grant execute on function public.trigger_sos(double precision, double precision, uuid) to authenticated;

-- Positions des courses actives pour la carte live admin (écran #10) —
-- extrait lat/lng des colonnes `geography` (jamais exposées telles
-- quelles au client, voir docs/11-securite.md) et ne renvoie que les
-- courses réellement « en direct » (jamais terminées/annulées).
create or replace function public.admin_active_rides_locations()
returns table (
  id uuid,
  category public.driver_category,
  status public.ride_status,
  pickup_lat double precision,
  pickup_lng double precision,
  driver_lat double precision,
  driver_lng double precision
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;

  return query
  select
    r.id,
    r.category,
    r.status,
    extensions.ST_Y(r.pickup_location::extensions.geometry),
    extensions.ST_X(r.pickup_location::extensions.geometry),
    extensions.ST_Y(d.current_location::extensions.geometry),
    extensions.ST_X(d.current_location::extensions.geometry)
  from public.rides r
  left join public.drivers d on d.id = r.driver_id
  where r.status in ('searching', 'accepted', 'driver_arriving', 'driver_arrived', 'in_progress');
end;
$$;

revoke execute on function public.admin_active_rides_locations() from public, anon;
grant execute on function public.admin_active_rides_locations() to authenticated;
