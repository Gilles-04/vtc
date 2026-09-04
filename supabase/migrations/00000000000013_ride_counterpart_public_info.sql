-- docs/11-securite.md §RLS : « un passager n'a aucun accès direct aux
-- tables drivers/vehicles — les informations affichées côté passager (nom,
-- note, véhicule) passent par une fonction dédiée qui ne renvoie que les
-- champs publics nécessaires, jamais la ligne complète » — et
-- symétriquement, `profiles_select` (migration 1) limite la lecture de
-- `profiles` à `auth.uid() = id`, donc un chauffeur ne peut pas non plus
-- lire le profil de son passager. Repéré en construisant l'écran passager
-- (apps/web) : `rides.profiles!passenger_id(...)` utilisé côté chauffeur
-- (DriverHome.tsx) pour afficher le nom du passager retournait déjà
-- silencieusement `null` en production (RLS bloque la ligne jointe, sans
-- erreur PostgREST) — corrigé dans le même mouvement.
--
-- Chaque fonction vérifie que l'appelant est bien partie prenante de la
-- course (ou staff admin) avant de renvoyer quoi que ce soit, et ne
-- sélectionne que les colonnes publiques nécessaires — jamais `select *`.

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
  if _ride.passenger_id <> auth.uid() and not private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[]) then
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
  if _ride.driver_id <> auth.uid() and not private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[]) then
    raise exception 'not_authorized';
  end if;

  return query select p.full_name from public.profiles p where p.id = _ride.passenger_id;
end;
$$;

grant execute on function public.get_ride_driver_public_info(uuid) to authenticated;
grant execute on function public.get_ride_passenger_public_info(uuid) to authenticated;
