-- Vérification du numéro de téléphone à l'inscription, via eSMS Verify
-- (docs/09-abonnement.md, docs/11-securite.md) — même principe déjà
-- éprouvé en production sur MBONPLAN, adapté ici à un flux *avant*
-- création de compte (le passager/chauffeur n'existe pas encore côté
-- `auth.users` au moment de la demande de code).
--
-- `phone_verifications` est suivie par NUMÉRO, pas par utilisateur
-- (contrairement à MBONPLAN où le compte existe déjà) : aucun accès
-- client direct, entièrement piloté par les deux Edge Functions
-- `phone-verification-start`/`phone-verification-check` via la clé de
-- service.

create table public.phone_verifications (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  verification_id text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index phone_verifications_phone_idx on public.phone_verifications (phone, created_at desc);

alter table public.phone_verifications enable row level security;
revoke all on public.phone_verifications from authenticated, anon;
-- Aucune policy : ni le client ni `authenticated` n'y accèdent jamais,
-- seul le rôle propriétaire (via les fonctions SECURITY DEFINER
-- ci-dessous, appelées par la clé de service) le peut.

create or replace function public.request_phone_verification(_phone text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform private.enforce_rate_limit('phone_verify:' || _phone, 5, 3600);
  insert into public.phone_verifications (phone, status) values (_phone, 'pending');
end;
$$;

create or replace function public.record_phone_verification(_phone text, _verification_id text, _expires_at timestamptz)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  update public.phone_verifications
  set verification_id = _verification_id, expires_at = _expires_at
  where id = (
    select id from public.phone_verifications
    where phone = _phone and status = 'pending'
    order by created_at desc limit 1
  );
$$;

create or replace function public.finalize_phone_verification(_phone text, _verification_id text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _updated integer;
begin
  update public.phone_verifications
  set status = 'verified'
  where phone = _phone
    and verification_id = _verification_id
    and status = 'pending'
    and (expires_at is null or expires_at > now());
  get diagnostics _updated = row_count;
  return _updated > 0;
end;
$$;

-- Résout un numéro vers un compte `auth.users` existant, sans lister tous
-- les comptes (ce que ferait un appel `listUsers()` côté client Admin —
-- ne passe pas à l'échelle). Le schéma `auth` n'est pas exposé par
-- l'API REST (voir `supabase/config.toml`), mais une fonction SQL peut
-- toujours y lire directement.
create or replace function public.find_user_id_by_phone(_phone text)
returns uuid
language sql
stable
security definer
set search_path = public, extensions, auth
as $$
  select id from auth.users where phone = _phone limit 1;
$$;

revoke execute on function public.request_phone_verification(text) from public, anon, authenticated;
revoke execute on function public.record_phone_verification(text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.finalize_phone_verification(text, text) from public, anon, authenticated;
revoke execute on function public.find_user_id_by_phone(text) from public, anon, authenticated;

grant execute on function public.request_phone_verification(text) to service_role;
grant execute on function public.record_phone_verification(text, text, timestamptz) to service_role;
grant execute on function public.finalize_phone_verification(text, text) to service_role;
grant execute on function public.find_user_id_by_phone(text) to service_role;
