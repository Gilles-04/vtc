-- Durcissement trouvé via `get_advisors` (Supabase MCP, maintenant connecté
-- directement au projet réel) : sur ce projet, `authenticated`/`anon`
-- reçoivent EXECUTE de façon explicite et directe à la création de toute
-- fonction `public` (privilèges par défaut du projet Supabase — pas le
-- mécanisme générique `PUBLIC` de Postgres). Migration 2 avait bien
-- pensé à révoquer `anon` en bloc (`revoke ... from public, anon`, une
-- seule fois, pour les fonctions déjà créées à ce moment-là) et migration 3
-- avait correctement révoqué les deux pour ses fonctions internes — mais
-- les fonctions trigger/cron de migration 2 elle-même et
-- `dispatch_push_notification` (migration 5, créée après coup) ont été
-- oubliées : `anon`/`authenticated` peuvent donc techniquement les
-- appeler en RPC direct (`/rest/v1/rpc/<fonction>`) alors qu'elles ne
-- sont censées être invoquées que par un trigger, `pg_cron`, ou le worker
-- de dispatch (`service_role`).
--
-- Sans risque de casser quoi que ce soit : un trigger s'exécute sans
-- vérifier l'EXECUTE de l'appelant du DML (seul le propriétaire de la
-- table compte), une tâche `pg_cron` s'exécute avec les privilèges du
-- rôle qui l'a planifiée (`postgres`, superutilisateur), et les fonctions
-- réservées au worker gardent leur `grant ... to service_role` explicite
-- (migration 2).

-- Fonctions déclenchées uniquement par trigger (`returns trigger`) :
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.generate_referral_code() from public, anon, authenticated;
revoke execute on function public.log_ride_status_change() from public, anon, authenticated;
revoke execute on function public.apply_rating_to_aggregate() from public, anon, authenticated;
revoke execute on function public.increment_promotion_redemptions() from public, anon, authenticated;
revoke execute on function public.flag_device_duplicate() from public, anon, authenticated;
revoke execute on function public.notify_admins_on_sos() from public, anon, authenticated;
revoke execute on function public.generate_invoice_on_ride_success() from public, anon, authenticated;
revoke execute on function public.dispatch_push_notification() from public, anon, authenticated;

-- Fonctions déclenchées uniquement par `pg_cron` :
revoke execute on function public.expire_subscriptions() from public, anon, authenticated;
revoke execute on function public.cleanup_rate_limits() from public, anon, authenticated;

-- Fonctions réservées au worker de dispatch (déjà `grant ... to service_role`
-- explicite en migration 2, conservé) :
revoke execute on function public.dispatch_next_offer(uuid) from public, anon, authenticated;
revoke execute on function public.expire_ride_offers_and_dispatch() from public, anon, authenticated;
