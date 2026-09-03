-- Même correctif que les migrations 7 (drivers/rides), 9 (payments) et 10
-- (invoices), appliqué cette fois à `user_roles.user_id` : référence
-- `auth.users` directement, jamais `public.profiles` — sans FK entre les
-- deux tables, PostgREST ne peut pas embarquer `user_roles(...)` dans une
-- requête sur `profiles`. Repéré en préparant l'écran admin Utilisateurs
-- (besoin d'afficher les rôles passager/chauffeur de chaque profil).
--
-- Ajout pur (aucune contrainte existante retirée) : chaque valeur de
-- user_roles.user_id est déjà un id auth.users pour lequel profiles.id
-- existe forcément (trigger handle_new_user à l'inscription).

alter table public.user_roles
  add constraint user_roles_user_id_profiles_fkey foreign key (user_id) references public.profiles (id);
