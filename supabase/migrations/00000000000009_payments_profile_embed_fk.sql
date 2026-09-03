-- Même correctif que la migration 7 (`profile_embed_fks`), appliqué cette
-- fois à `payments.user_id` : référence `auth.users` directement, jamais
-- `public.profiles` — sans FK entre les deux tables, PostgREST ne peut
-- pas embarquer `profiles(...)` dans une requête sur `payments`. Repéré
-- en préparant l'écran admin Paiements (besoin d'afficher qui a payé).
--
-- Ajout pur (aucune contrainte existante retirée) : chaque valeur de
-- payments.user_id est déjà un id auth.users pour lequel profiles.id
-- existe forcément (trigger handle_new_user à l'inscription).

alter table public.payments
  add constraint payments_user_id_profiles_fkey foreign key (user_id) references public.profiles (id);
