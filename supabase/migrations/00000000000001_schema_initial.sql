-- Schéma initial de la plateforme VTC (MVP)
-- Voir docs/06-schema-base-donnees.md pour la description narrative,
-- docs/11-securite.md pour les principes RLS appliqués ici.
--
-- Convention : toute mutation qui touche à l'argent (paiements, abonnements),
-- au dispatch d'une course (rides, ride_offers) ou qui exige une trace
-- d'audit (décisions admin : validation KYC, suspension, résolution de
-- réclamation/SOS) ne reçoit **aucune** policy RLS d'écriture directe ici.
-- Ces écritures passent exclusivement par des fonctions SECURITY DEFINER
-- (RPC) ou par les Edge Functions (clé de service), ajoutées dans les
-- migrations des phases correspondantes de docs/12-roadmap.md — jamais par
-- un accès table brut depuis le client, même authentifié.

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

-- ========================================================================
-- ENUMS
-- ========================================================================

create type public.app_user_role as enum ('passenger', 'driver');
create type public.admin_role as enum ('super_admin', 'admin', 'support', 'finance');
create type public.driver_status as enum ('pending_documents', 'pending_review', 'approved', 'rejected', 'suspended');
create type public.driver_doc_type as enum ('piece_identite', 'permis_conduire', 'carte_transport', 'assurance', 'carte_grise', 'photo_vehicule');
create type public.doc_status as enum ('pending', 'approved', 'rejected');
create type public.subscription_status as enum ('active', 'expired', 'cancelled');
create type public.payment_purpose as enum ('driver_subscription');
create type public.payment_provider as enum ('flooz', 'tmoney', 'manual');
create type public.payment_status as enum ('pending', 'success', 'failed', 'refunded');
create type public.ride_status as enum ('requested', 'searching', 'accepted', 'driver_arriving', 'arrived', 'in_progress', 'completed', 'cancelled_by_passenger', 'cancelled_by_driver', 'no_drivers_found');
create type public.ride_offer_status as enum ('pending', 'accepted', 'rejected', 'expired');
create type public.cancelled_by_type as enum ('passenger', 'driver', 'system');
create type public.payment_method_type as enum ('cash', 'mobile_money');
create type public.rater_role_type as enum ('passenger', 'driver');
create type public.report_status as enum ('open', 'investigating', 'resolved', 'dismissed');
create type public.sos_status as enum ('open', 'acknowledged', 'resolved');

-- ========================================================================
-- TABLES
-- ========================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  full_name text,
  avatar_url text,
  language text not null default 'fr' check (language in ('fr', 'en')),
  is_suspended boolean not null default false,
  suspended_reason text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_user_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.admin_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.admin_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  boundary extensions.geography(Polygon, 4326),
  night_start_time time not null default '20:00',
  night_end_time time not null default '05:00',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.drivers (
  id uuid primary key references auth.users (id) on delete cascade,
  status public.driver_status not null default 'pending_documents',
  city text,
  is_available boolean not null default false,
  current_location extensions.geography(Point, 4326),
  last_location_at timestamptz,
  rating_avg numeric(2, 1) not null default 5.0,
  rating_count integer not null default 0,
  total_rides integer not null default 0,
  created_at timestamptz not null default now()
);

create index drivers_current_location_gix on public.drivers using gist (current_location);
create index drivers_available_approved_idx on public.drivers (status, is_available) where status = 'approved' and is_available = true;

create table public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  doc_type public.driver_doc_type not null,
  file_path text not null,
  status public.doc_status not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  expires_at date,
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null unique references public.drivers (id) on delete cascade,
  brand text not null,
  model text not null,
  color text not null,
  plate_number text not null unique,
  year integer,
  photo_path text,
  created_at timestamptz not null default now()
);

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  duration_hours integer not null,
  price_fcfa integer,
  is_active boolean not null default false,
  sort_order integer not null default 0,
  constraint subscription_plans_active_price_chk check (not is_active or price_fcfa is not null)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  purpose public.payment_purpose not null,
  amount_fcfa integer not null,
  provider public.payment_provider not null,
  provider_ref text,
  status public.payment_status not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null,
  event_key text not null unique,
  payload jsonb not null,
  payment_id uuid references public.payments (id),
  processed_at timestamptz
);

create table public.driver_subscriptions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id),
  payment_id uuid references public.payments (id),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status public.subscription_status not null default 'active'
);

create unique index driver_subscriptions_one_active_idx on public.driver_subscriptions (driver_id) where status = 'active';

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references public.zones (id),
  base_fare_fcfa integer not null,
  price_per_km_fcfa integer not null,
  price_per_min_fcfa integer not null,
  minimum_fare_fcfa integer not null,
  night_multiplier_percent integer not null default 0,
  effective_from timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references auth.users (id),
  driver_id uuid references public.drivers (id),
  status public.ride_status not null default 'requested',
  pickup_location extensions.geography(Point, 4326) not null,
  pickup_address text not null,
  dropoff_location extensions.geography(Point, 4326) not null,
  dropoff_address text not null,
  zone_id uuid references public.zones (id),
  pricing_rule_id uuid references public.pricing_rules (id),
  estimated_distance_km numeric(6, 2),
  estimated_duration_min numeric(6, 1),
  estimated_fare_fcfa integer,
  final_distance_km numeric(6, 2),
  final_duration_min numeric(6, 1),
  final_fare_fcfa integer,
  payment_method public.payment_method_type not null default 'cash',
  requested_at timestamptz not null default now(),
  matched_at timestamptz,
  driver_arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by public.cancelled_by_type,
  cancellation_reason text
);

create index rides_passenger_idx on public.rides (passenger_id);
create index rides_driver_idx on public.rides (driver_id);
create index rides_status_idx on public.rides (status);

create table public.ride_offers (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  driver_id uuid not null references public.drivers (id),
  rank integer not null,
  status public.ride_offer_status not null default 'pending',
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null,
  unique (ride_id, rank)
);

create index ride_offers_driver_pending_idx on public.ride_offers (driver_id, status);

create table public.ride_locations (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  driver_id uuid not null references public.drivers (id),
  location extensions.geography(Point, 4326) not null,
  recorded_at timestamptz not null default now()
);

create index ride_locations_ride_idx on public.ride_locations (ride_id, recorded_at);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  rater_id uuid not null references auth.users (id),
  ratee_id uuid not null references auth.users (id),
  rater_role public.rater_role_type not null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (ride_id, rater_role)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid references public.rides (id),
  reporter_id uuid not null references auth.users (id),
  reported_user_id uuid references auth.users (id),
  category text not null,
  description text not null,
  status public.report_status not null default 'open',
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now()
);

create table public.sos_alerts (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid references public.rides (id),
  triggered_by uuid not null references auth.users (id),
  location extensions.geography(Point, 4326) not null,
  status public.sos_status not null default 'open',
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id),
  action text not null,
  target_table text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ========================================================================
-- FONCTIONS D'ASSISTANCE (schéma private, jamais exposé par l'API REST)
-- ========================================================================

create or replace function private.has_admin_role(_roles public.admin_role[])
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.admin_roles ar
    where ar.user_id = auth.uid() and ar.role = any(_roles)
  );
$$;

grant usage on schema private to authenticated, anon;
grant execute on function private.has_admin_role(public.admin_role[]) to authenticated, anon;

-- ========================================================================
-- TRIGGER : profil + rôle passager créés à l'inscription
-- ========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.profiles (id, phone) values (new.id, new.phone);
  insert into public.user_roles (user_id, role) values (new.id, 'passenger');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========================================================================
-- RLS
-- ========================================================================

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.admin_roles enable row level security;
alter table public.zones enable row level security;
alter table public.drivers enable row level security;
alter table public.driver_documents enable row level security;
alter table public.vehicles enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.driver_subscriptions enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.rides enable row level security;
alter table public.ride_offers enable row level security;
alter table public.ride_locations enable row level security;
alter table public.ratings enable row level security;
alter table public.reports enable row level security;
alter table public.sos_alerts enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- profiles : chacun lit/édite le sien (hors is_suspended, réservé RPC admin
-- pour garder une trace d'audit) ; le staff admin lit tout.
revoke all on public.profiles from authenticated, anon;
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url, language) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select using (
  auth.uid() = id or private.has_admin_role(array['super_admin', 'admin', 'support', 'finance']::public.admin_role[])
);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);

-- user_roles : lecture seule côté client (écriture par le trigger/RPC).
revoke all on public.user_roles from authenticated, anon;
grant select on public.user_roles to authenticated;

create policy user_roles_select on public.user_roles for select using (
  auth.uid() = user_id or private.has_admin_role(array['super_admin', 'admin']::public.admin_role[])
);

-- admin_roles : entièrement réservé au super_admin.
revoke all on public.admin_roles from authenticated, anon;
grant select, insert, update, delete on public.admin_roles to authenticated;

create policy admin_roles_all on public.admin_roles for all using (
  private.has_admin_role(array['super_admin']::public.admin_role[])
) with check (
  private.has_admin_role(array['super_admin']::public.admin_role[])
);

-- zones : lecture publique (nécessaire à l'estimation de prix), écriture
-- admin directe (table de configuration, pas un flux financier).
revoke all on public.zones from authenticated, anon;
grant select on public.zones to authenticated, anon;
grant insert, update on public.zones to authenticated;

create policy zones_select_all on public.zones for select using (true);
create policy zones_write_admin on public.zones for insert with check (
  private.has_admin_role(array['super_admin', 'admin']::public.admin_role[])
);
create policy zones_update_admin on public.zones for update using (
  private.has_admin_role(array['super_admin', 'admin']::public.admin_role[])
);

-- drivers : jamais visible par un passager (voir docs/11-securite.md — les
-- infos publiques passeront par une fonction dédiée, Phase 4). Le chauffeur
-- ne peut modifier que sa disponibilité et sa position ; `status` et les
-- compteurs de réputation ne sont modifiables que par les futures RPC/Edge
-- Functions (clé de service), jamais en direct.
revoke all on public.drivers from authenticated, anon;
grant select on public.drivers to authenticated;
grant insert (id, city) on public.drivers to authenticated;
grant update (is_available, current_location, last_location_at) on public.drivers to authenticated;

create policy drivers_select on public.drivers for select using (
  auth.uid() = id or private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[])
);
create policy drivers_insert_own on public.drivers for insert with check (auth.uid() = id);
create policy drivers_update_own on public.drivers for update using (auth.uid() = id) with check (auth.uid() = id);

-- driver_documents : le chauffeur soumet (statut toujours 'pending' par
-- défaut, colonnes de décision non accordées) ; la décision d'approbation/
-- rejet est réservée à la future RPC admin (trace d'audit obligatoire).
revoke all on public.driver_documents from authenticated, anon;
grant select on public.driver_documents to authenticated;
grant insert (driver_id, doc_type, file_path) on public.driver_documents to authenticated;

create policy driver_documents_select on public.driver_documents for select using (
  driver_id = auth.uid() or private.has_admin_role(array['super_admin', 'admin']::public.admin_role[])
);
create policy driver_documents_insert_own on public.driver_documents for insert with check (driver_id = auth.uid());

-- vehicles : simplification MVP assumée — le chauffeur gère librement son
-- véhicule déclaré ; l'admin le voit au moment de la revue du dossier KYC.
revoke all on public.vehicles from authenticated, anon;
grant select, insert, update on public.vehicles to authenticated;

create policy vehicles_select on public.vehicles for select using (
  driver_id = auth.uid() or private.has_admin_role(array['super_admin', 'admin']::public.admin_role[])
);
create policy vehicles_insert_own on public.vehicles for insert with check (driver_id = auth.uid());
create policy vehicles_update_own on public.vehicles for update using (driver_id = auth.uid());

-- subscription_plans : lecture publique, écriture admin directe (config).
revoke all on public.subscription_plans from authenticated, anon;
grant select on public.subscription_plans to authenticated, anon;
grant insert, update on public.subscription_plans to authenticated;

create policy subscription_plans_select_all on public.subscription_plans for select using (true);
create policy subscription_plans_write_admin on public.subscription_plans for insert with check (
  private.has_admin_role(array['super_admin', 'admin']::public.admin_role[])
);
create policy subscription_plans_update_admin on public.subscription_plans for update using (
  private.has_admin_role(array['super_admin', 'admin']::public.admin_role[])
);

-- payments, payment_webhook_events, driver_subscriptions : lecture seule
-- côté client — toute écriture passe par les Edge Functions (clé de
-- service), voir docs/10-paiements.md et docs/09-abonnement.md.
revoke all on public.payments from authenticated, anon;
grant select on public.payments to authenticated;

create policy payments_select on public.payments for select using (
  user_id = auth.uid() or private.has_admin_role(array['super_admin', 'admin', 'finance']::public.admin_role[])
);

revoke all on public.payment_webhook_events from authenticated, anon;
grant select on public.payment_webhook_events to authenticated;

create policy payment_webhook_events_select_admin on public.payment_webhook_events for select using (
  private.has_admin_role(array['super_admin', 'finance']::public.admin_role[])
);

revoke all on public.driver_subscriptions from authenticated, anon;
grant select on public.driver_subscriptions to authenticated;

create policy driver_subscriptions_select on public.driver_subscriptions for select using (
  driver_id = auth.uid() or private.has_admin_role(array['super_admin', 'admin', 'finance']::public.admin_role[])
);

-- pricing_rules : lecture publique (estimation de prix), écriture admin en
-- ajout seul (jamais de modification d'une règle déjà appliquée à une
-- course — voir docs/06-schema-base-donnees.md).
revoke all on public.pricing_rules from authenticated, anon;
grant select on public.pricing_rules to authenticated, anon;
grant insert on public.pricing_rules to authenticated;

create policy pricing_rules_select_all on public.pricing_rules for select using (true);
create policy pricing_rules_insert_admin on public.pricing_rules for insert with check (
  private.has_admin_role(array['super_admin', 'admin']::public.admin_role[])
);

-- rides, ride_offers, ride_locations(écriture) : aucune écriture cliente
-- directe pour rides/ride_offers — passe par create_ride_request,
-- respond_to_ride_offer, etc. (RPC SECURITY DEFINER, Phase 4 de la
-- roadmap). ride_locations accepte l'insertion directe du chauffeur assigné
-- (simple flux de position, pas de règle métier à protéger).
revoke all on public.rides from authenticated, anon;
grant select on public.rides to authenticated;

create policy rides_select on public.rides for select using (
  passenger_id = auth.uid() or driver_id = auth.uid()
  or private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[])
);

revoke all on public.ride_offers from authenticated, anon;
grant select on public.ride_offers to authenticated;

create policy ride_offers_select_own on public.ride_offers for select using (
  driver_id = auth.uid() or private.has_admin_role(array['super_admin', 'admin']::public.admin_role[])
);

revoke all on public.ride_locations from authenticated, anon;
grant select, insert on public.ride_locations to authenticated;

create policy ride_locations_select on public.ride_locations for select using (
  driver_id = auth.uid()
  or exists (select 1 from public.rides r where r.id = ride_id and r.passenger_id = auth.uid())
  or private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[])
);
create policy ride_locations_insert_driver on public.ride_locations for insert with check (driver_id = auth.uid());

-- ratings : un avis par sens et par course, uniquement sur une course
-- terminée dont l'auteur est réellement partie prenante.
revoke all on public.ratings from authenticated, anon;
grant select, insert on public.ratings to authenticated;

create policy ratings_select on public.ratings for select using (
  rater_id = auth.uid() or ratee_id = auth.uid() or private.has_admin_role(array['super_admin', 'admin']::public.admin_role[])
);
create policy ratings_insert_own on public.ratings for insert with check (
  rater_id = auth.uid()
  and exists (
    select 1 from public.rides r
    where r.id = ride_id
      and r.status = 'completed'
      and (
        (rater_role = 'passenger' and r.passenger_id = auth.uid() and ratee_id = r.driver_id)
        or (rater_role = 'driver' and r.driver_id = auth.uid() and ratee_id = r.passenger_id)
      )
  )
);

-- reports, sos_alerts : création libre par la victime/témoin ; la
-- résolution est réservée à la future RPC admin (trace d'audit).
revoke all on public.reports from authenticated, anon;
grant select, insert on public.reports to authenticated;

create policy reports_select on public.reports for select using (
  reporter_id = auth.uid() or private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[])
);
create policy reports_insert_own on public.reports for insert with check (reporter_id = auth.uid());

revoke all on public.sos_alerts from authenticated, anon;
grant select, insert on public.sos_alerts to authenticated;

create policy sos_alerts_select on public.sos_alerts for select using (
  triggered_by = auth.uid() or private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[])
);
create policy sos_alerts_insert_own on public.sos_alerts for insert with check (triggered_by = auth.uid());

-- notifications : chacun lit les siennes et peut seulement marquer comme lu.
revoke all on public.notifications from authenticated, anon;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select_own on public.notifications for select using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update using (user_id = auth.uid());

-- audit_logs : lecture admin uniquement, écriture réservée aux fonctions
-- serveur (jamais de policy d'écriture cliente).
revoke all on public.audit_logs from authenticated, anon;
grant select on public.audit_logs to authenticated;

create policy audit_logs_select_admin on public.audit_logs for select using (
  private.has_admin_role(array['super_admin', 'admin']::public.admin_role[])
);

-- ========================================================================
-- SEED : plans d'abonnement (docs/09-abonnement.md)
-- ========================================================================

insert into public.subscription_plans (code, name, duration_hours, price_fcfa, is_active, sort_order) values
  ('pass_jour', 'Pass Jour', 24, 1500, true, 1),
  ('pass_7j', 'Pass 7 jours', 168, null, false, 2),
  ('pass_30j', 'Pass 30 jours', 720, null, false, 3);
