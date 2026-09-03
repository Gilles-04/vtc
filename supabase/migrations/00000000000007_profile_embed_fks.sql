-- Corrige un embedding PostgREST cassé, repéré en préparant l'écran
-- « Liste courses » : `drivers.id` et `rides.passenger_id` référencent
-- auth.users directement, jamais public.profiles — contrairement à
-- `passengers.id` qui référence bien profiles. PostgREST ne peut embarquer
-- une relation que via une contrainte FK explicite entre les deux tables
-- demandées ; sans elle, `select('..., profiles(...)')` échoue à
-- l'exécution avec « Could not find a relationship... ». C'est le cas de
-- `Drivers.tsx`/`DriverDetail.tsx` (apps/admin), déjà commités mais jamais
-- exercés contre de vraies données (réseau sandbox bloqué) — cette
-- migration les corrige rétroactivement sans toucher leur code.
--
-- Ajout pur (aucune contrainte existante retirée) : chaque valeur de
-- drivers.id / rides.passenger_id est déjà un id auth.users pour lequel
-- profiles.id existe forcément (trigger handle_new_user à l'inscription,
-- migration 1) — la contrainte est donc satisfaite par toutes les lignes
-- déjà en place sur le projet réel.

alter table public.drivers
  add constraint drivers_id_profiles_fkey foreign key (id) references public.profiles (id);

alter table public.rides
  add constraint rides_passenger_id_profiles_fkey foreign key (passenger_id) references public.profiles (id);
