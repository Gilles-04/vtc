-- Même correctif que les migrations 7 (drivers/rides), 9 (payments), 10
-- (invoices) et 11 (user_roles) : `reports.reporter_id`,
-- `reports.reported_user_id` et `sos_alerts.triggered_by` référencent
-- `auth.users` directement, jamais `public.profiles` — sans FK, PostgREST
-- ne peut pas embarquer `profiles(...)` dans une requête sur ces tables.
-- Repéré en préparant l'écran admin Réclamations & SOS (besoin d'afficher
-- qui a signalé/déclenché quoi).
--
-- Ajout pur (aucune contrainte existante retirée) : chaque valeur de ces
-- colonnes est déjà un id auth.users pour lequel profiles.id existe
-- forcément (trigger handle_new_user à l'inscription).

alter table public.reports
  add constraint reports_reporter_id_profiles_fkey foreign key (reporter_id) references public.profiles (id);

alter table public.reports
  add constraint reports_reported_user_id_profiles_fkey foreign key (reported_user_id) references public.profiles (id);

alter table public.sos_alerts
  add constraint sos_alerts_triggered_by_profiles_fkey foreign key (triggered_by) references public.profiles (id);
