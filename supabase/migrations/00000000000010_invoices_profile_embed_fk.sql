-- Même correctif que les migrations 7 (drivers/rides) et 9 (payments),
-- appliqué cette fois à `invoices.passenger_id` : référence `auth.users`
-- directement, jamais `public.profiles` — sans FK entre les deux tables,
-- PostgREST ne peut pas embarquer `profiles(...)` dans une requête sur
-- `invoices`. Repéré en préparant l'écran admin Facturation (besoin
-- d'afficher l'identité du passager).
--
-- Ajout pur (aucune contrainte existante retirée) : chaque valeur de
-- invoices.passenger_id est déjà un id auth.users pour lequel profiles.id
-- existe forcément (trigger handle_new_user à l'inscription).

alter table public.invoices
  add constraint invoices_passenger_id_profiles_fkey foreign key (passenger_id) references public.profiles (id);
