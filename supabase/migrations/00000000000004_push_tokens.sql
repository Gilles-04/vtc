-- Jeton de notification push (Expo) — un seul par compte au MVP : le
-- dernier appareil enregistré gagne. Suffisant tant qu'un compte n'a pas
-- plusieurs appareils actifs en parallèle (cas marginal pour ce produit) ;
-- passer à une table dédiée le jour où ça devient nécessaire.
alter table public.profiles add column push_token text;

-- Colonne isolée du reste du profil par un GRANT dédié, même principe que
-- `full_name`/`avatar_url`/`language` (migration 1) — la policy RLS
-- `profiles_update_own` existante couvre déjà la ligne, ce grant ne fait
-- qu'ajouter cette colonne à ce qui est modifiable.
grant update (push_token) on public.profiles to authenticated;
