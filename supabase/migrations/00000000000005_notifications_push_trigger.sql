-- Contournement d'une anomalie du projet Supabase VTC Togo : la création
-- d'un Database Webhook (dashboard) échoue avec
-- `ERROR: 3F000: schema "supabase_functions" does not exist` — ce schéma,
-- normalement provisionné par défaut sur tout projet Supabase pour porter
-- le mécanisme des Database Webhooks, est absent sur ce projet précis
-- (confirmé : `pg_net` est bien installé, seul `supabase_functions` manque).
--
-- Reproduit ici le même mécanisme à la main avec `pg_net` directement
-- (schéma `net`, déjà utilisé pour ce cas précis dans la documentation
-- Supabase elle-même comme alternative aux Database Webhooks) : un trigger
-- `AFTER INSERT` sur `notifications` envoie exactement le même payload
-- ({type, table, record}) que l'aurait envoyé un vrai Database Webhook —
-- `push-notifications-dispatch` n'a donc besoin d'aucune modification.

-- Config non sensible (clé "publishable", faite pour être publique — même
-- principe que dans un bundle d'app mobile) sortie du code de la fonction
-- pour rester facilement modifiable sans réécrire la fonction (même
-- convention que `private.app_settings` sur MBONPLAN pour les tâches
-- pg_cron ayant besoin d'un secret/paramètre côté base).
create table if not exists private.app_settings (
  key text primary key,
  value text not null
);

insert into private.app_settings (key, value) values
  ('supabase_url', 'https://elrsjctwrvzglwogmmpq.supabase.co'),
  ('supabase_publishable_key', 'sb_publishable_SUCOCoz7sPIEk8vmo2Ce0w_jul1teUg')
on conflict (key) do update set value = excluded.value;

create or replace function public.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net, private
as $$
declare
  _url text;
  _key text;
begin
  select value into _url from private.app_settings where key = 'supabase_url';
  select value into _key from private.app_settings where key = 'supabase_publishable_key';

  perform net.http_post(
    url := _url || '/functions/v1/push-notifications-dispatch',
    body := jsonb_build_object('type', 'INSERT', 'table', 'notifications', 'record', to_jsonb(new)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _key)
  );
  return new;
end;
$$;

create trigger notifications_dispatch_push
  after insert on public.notifications
  for each row execute function public.dispatch_push_notification();
