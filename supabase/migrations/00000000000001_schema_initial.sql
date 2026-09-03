-- Schéma de données de la plateforme VTC — structure (tables, enums, index, RLS).
-- La logique métier (RPC, triggers, tâches planifiées) vit dans
-- 00000000000002_business_logic.sql. Voir docs/06-schema-base-donnees.md pour
-- la description narrative, docs/11-securite.md pour les principes RLS.
--
-- Convention : toute mutation qui touche à l'argent (paiements, abonnements),
-- au dispatch d'une course (rides, ride_offers) ou qui exige une trace
-- d'audit (décisions admin) ne reçoit **aucune** policy RLS d'écriture
-- directe ici — uniquement des fonctions SECURITY DEFINER (migration 2) ou
-- des Edge Functions (clé de service), jamais un accès table brut.

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

-- ========================================================================
-- ENUMS
-- ========================================================================

create type public.app_user_role as enum ('passenger', 'driver');
create type public.admin_role as enum ('super_admin', 'admin', 'support', 'finance');
-- Deux catégories parallèles de conducteurs (§01-architecture-fonctionnelle.md
-- §Deux catégories) : chacune a son propre abonnement, sa propre
-- tarification, son propre pool de matching.
create type public.driver_category as enum ('car', 'moto');
create type public.driver_status as enum ('pending_documents', 'pending_review', 'approved', 'rejected', 'suspended');
create type public.driver_doc_type as enum ('piece_identite', 'permis_conduire', 'carte_transport', 'assurance', 'carte_grise', 'photo_vehicule');
create type public.doc_status as enum ('pending', 'approved', 'rejected');
create type public.subscription_status as enum ('active', 'expired', 'cancelled');
-- 'ride_fare' réservé pour une future intermédiation du prix de la course
-- par la plateforme (voir docs/10-paiements.md) — non utilisé au MVP, le
-- prix de la course reste réglé directement passager -> chauffeur.
create type public.payment_purpose as enum ('driver_subscription', 'ride_fare');
create type public.payment_provider as enum ('flooz', 'tmoney', 'manual');
create type public.payment_status as enum ('pending', 'processing', 'success', 'failed', 'cancelled', 'refunded');
create type public.ride_status as enum ('requested', 'searching', 'accepted', 'driver_arriving', 'driver_arrived', 'in_progress', 'completed', 'cancelled_by_passenger', 'cancelled_by_driver', 'cancelled_by_system');
create type public.ride_offer_status as enum ('pending', 'accepted', 'rejected', 'expired');
create type public.settlement_status as enum ('pending', 'settled');
create type public.cancelled_by_type as enum ('passenger', 'driver', 'system');
create type public.payment_method_type as enum ('cash', 'mobile_money');
create type public.rater_role_type as enum ('passenger', 'driver');
create type public.report_status as enum ('open', 'investigating', 'resolved', 'dismissed');
create type public.sos_status as enum ('open', 'acknowledged', 'resolved');
create type public.support_ticket_category as enum ('paiement', 'course', 'compte', 'document', 'autre');
create type public.support_ticket_status as enum ('open', 'pending', 'resolved', 'closed');
create type public.support_ticket_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.support_sender_type as enum ('user', 'staff');
create type public.promotion_discount_type as enum ('percent', 'fixed');
create type public.promotion_applies_to as enum ('subscription');
create type public.fraud_subject_type as enum ('user', 'driver', 'device');
create type public.fraud_flag_status as enum ('open', 'reviewing', 'confirmed', 'dismissed');
create type public.fraud_severity as enum ('low', 'medium', 'high');

-- ========================================================================
-- IDENTITÉ
-- ========================================================================
-- `auth.users` (géré par Supabase Auth) est la table "users" de
-- l'architecture : identifiants, téléphone vérifié, session. `profiles` la
-- prolonge avec les champs communs à tout compte ; `passengers`/`drivers`
-- portent les données propres à chaque casquette (un compte peut cumuler
-- les deux, voir docs/11-securite.md).

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

create table public.passengers (
  id uuid primary key references public.profiles (id) on delete cascade,
  preferred_payment_method public.payment_method_type not null default 'cash',
  referral_code text unique,
  referred_by uuid references public.passengers (id),
  rating_avg numeric(2, 1) not null default 5.0,
  rating_count integer not null default 0,
  total_rides integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.drivers (
  id uuid primary key references auth.users (id) on delete cascade,
  category public.driver_category not null,
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

-- ========================================================================
-- ABONNEMENTS & PAIEMENTS
-- ========================================================================

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category public.driver_category not null,
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

-- Un identifiant de transaction fournisseur (`provider_ref`) ne peut jamais
-- être rattaché à deux paiements distincts, quel que soit le flux
-- (abonnement ou course) — rejeu/réutilisation d'un `transaction_id`
-- bloqué au niveau base, pas seulement par la déduplication applicative du
-- webhook (`payment_webhook_events.event_key`, qui dédoublonne la
-- *livraison* du webhook, pas la transaction elle-même).
create unique index payments_provider_ref_unique_idx on public.payments (provider, provider_ref) where provider_ref is not null;

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null,
  event_key text not null unique,
  payload jsonb not null,
  payment_id uuid references public.payments (id),
  processed_at timestamptz
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id),
  payment_id uuid references public.payments (id),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status public.subscription_status not null default 'active'
);

create unique index subscriptions_one_active_idx on public.subscriptions (driver_id) where status = 'active';
create index subscriptions_driver_idx on public.subscriptions (driver_id, started_at desc);

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type public.promotion_discount_type not null,
  discount_value integer not null,
  applies_to public.promotion_applies_to not null default 'subscription',
  max_redemptions integer,
  redemptions_count integer not null default 0,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint promotions_discount_value_chk check (discount_value > 0),
  constraint promotions_percent_range_chk check (discount_type <> 'percent' or discount_value <= 100)
);

create table public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions (id),
  user_id uuid not null references auth.users (id),
  payment_id uuid references public.payments (id),
  redeemed_at timestamptz not null default now(),
  unique (promotion_id, user_id)
);

-- Règlement périodique des frais de service (2,5 % / course, voir
-- docs/01-architecture-fonctionnelle.md §Comment les frais de service sont
-- réellement perçus) : le prix de la course reste payé directement
-- passager -> chauffeur, donc la créance de la plateforme envers le
-- chauffeur s'accumule course par course (`rides.platform_fee_fcfa`) et se
-- solde ici par lot, jamais course par course. Écriture réservée aux RPC
-- admin/finance (migration 2), aucune policy d'écriture cliente.
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id),
  period_start timestamptz not null,
  period_end timestamptz not null,
  rides_count integer not null default 0,
  gross_transport_fcfa integer not null default 0,
  platform_fees_fcfa integer not null default 0,
  status public.settlement_status not null default 'pending',
  settlement_method text,
  settled_at timestamptz,
  settled_by uuid references auth.users (id),
  notes text,
  created_at timestamptz not null default now()
);

create index settlements_driver_idx on public.settlements (driver_id, period_start desc);
create index settlements_pending_idx on public.settlements (status) where status = 'pending';

-- ========================================================================
-- TARIFICATION & ZONES
-- ========================================================================

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

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  category public.driver_category not null,
  zone_id uuid references public.zones (id),
  base_fare_fcfa integer not null,
  price_per_km_fcfa integer not null,
  price_per_min_fcfa integer not null,
  minimum_fare_fcfa integer not null,
  night_multiplier_percent integer not null default 0,
  effective_from timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

-- ========================================================================
-- COURSES
-- ========================================================================

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references auth.users (id),
  driver_id uuid references public.drivers (id),
  category public.driver_category not null,
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
  -- Statut du règlement du prix de la course (passager -> chauffeur, hors
  -- plateforme) : distinct du statut de la course elle-même. La facture et
  -- le crédit des 2,5 % de frais de service ne sont générés qu'une fois
  -- 'success' (voir §Cycle de vie en docs/01-architecture-fonctionnelle.md).
  payment_status public.payment_status not null default 'pending',
  -- Frais de service (2,5 % du prix final) et part reversée au chauffeur —
  -- calculés une fois seulement à la complétion (complete_ride, migration 2),
  -- jamais recalculés ensuite. Nuls tant que la course n'est pas terminée.
  platform_fee_fcfa integer,
  driver_amount_fcfa integer,
  settlement_id uuid references public.settlements (id),
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

-- Ajoutée ici (`alter table`, pas dans la définition de `payments` plus
-- haut) car `rides` n'existe pas encore au moment où `payments` est créée
-- — même table, même paiement de course que celui suivi sur
-- `rides.payment_status`/`platform_fee_fcfa`, ce n'est pas une donnée
-- dupliquée : `payments` porte le cycle de vie de la transaction
-- (pending/processing/success/failed/...), `rides` porte le résultat figé
-- une fois le paiement confirmé.
alter table public.payments add column ride_id uuid references public.rides (id);
create index payments_ride_idx on public.payments (ride_id) where ride_id is not null;

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
create index ride_offers_ride_status_idx on public.ride_offers (ride_id, status);
create index ride_offers_expiry_idx on public.ride_offers (expires_at) where status = 'pending';

-- Journal complet de tous les changements de statut d'une course, alimenté
-- automatiquement par un trigger (migration 2) — jamais écrit à la main :
-- c'est la source d'historique/preuve en cas de litige, indépendante de ce
-- que l'application affiche.
create table public.ride_status_history (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  from_status public.ride_status,
  to_status public.ride_status not null,
  changed_by uuid references auth.users (id),
  changed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index ride_status_history_ride_idx on public.ride_status_history (ride_id, changed_at);

-- Facture générée automatiquement (trigger, migration 2) dès qu'une course
-- passe à 'completed' avec payment_status = 'success' — jamais à la main.
-- Une ligne par course (unique (ride_id)) ; le rendu PDF n'existe pas
-- encore au MVP (voir docs/01-architecture-fonctionnelle.md), seule cette
-- ligne de facturation est produite pour l'instant.
create sequence public.invoice_number_seq;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default ('VTC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0')),
  ride_id uuid not null unique references public.rides (id),
  passenger_id uuid not null references auth.users (id),
  driver_id uuid not null references public.drivers (id),
  transport_amount_fcfa integer not null,
  platform_fee_fcfa integer not null,
  total_fcfa integer not null,
  payment_method public.payment_method_type not null,
  payment_reference text,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter sequence public.invoice_number_seq owned by public.invoices.invoice_number;

-- Positions du chauffeur, échantillonnées côté client (~1 point/5-10s).
-- `ride_id` est renseigné quand le point est capté pendant une course
-- (reconstruction du trajet, litiges) et nul le reste du temps (position de
-- fond pendant que le chauffeur est disponible — alimente aussi la
-- détection d'anomalie GPS, voir §anti-fraude en migration 2).
create table public.driver_locations (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  ride_id uuid references public.rides (id),
  location extensions.geography(Point, 4326) not null,
  accuracy_meters numeric(6, 1),
  recorded_at timestamptz not null default now()
);

create index driver_locations_driver_idx on public.driver_locations (driver_id, recorded_at desc);
create index driver_locations_ride_idx on public.driver_locations (ride_id, recorded_at) where ride_id is not null;

-- ========================================================================
-- CONFIANCE & SÉCURITÉ
-- ========================================================================

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

-- support_tickets/messages : assistance générale (paiement, compte...),
-- distincte de `reports` (signalement d'un comportement lié à une course)
-- et de `sos_alerts` (urgence en cours de course).
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  category public.support_ticket_category not null default 'autre',
  subject text not null,
  status public.support_ticket_status not null default 'open',
  priority public.support_ticket_priority not null default 'normal',
  ride_id uuid references public.rides (id),
  assigned_to uuid references auth.users (id),
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index support_tickets_status_idx on public.support_tickets (status, created_at);

create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_id uuid not null references auth.users (id),
  sender_type public.support_sender_type not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index support_ticket_messages_ticket_idx on public.support_ticket_messages (ticket_id, created_at);

-- ========================================================================
-- ANTI-FRAUDE
-- ========================================================================
-- Trois mécanismes complémentaires : détection d'appareils partagés entre
-- comptes (`device_fingerprints`), limitation de débit sur les actions
-- sensibles (`rate_limit_counters`, jamais exposé au client), et une file
-- de signalements centralisée pour revue humaine (`fraud_flags`) — jamais
-- de bannissement automatique silencieux, voir migration 2.

create table public.device_fingerprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text not null,
  platform text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create index device_fingerprints_device_idx on public.device_fingerprints (device_id);

-- Référence polymorphe volontaire (`subject_type` + `subject_id text`) :
-- un signalement peut porter sur un compte (uuid en texte), un chauffeur
-- (idem) ou un appareil (device_id déjà textuel) — une seule table de revue
-- plutôt que trois tables quasi identiques.
create table public.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  subject_type public.fraud_subject_type not null,
  subject_id text not null,
  reason text not null,
  severity public.fraud_severity not null default 'medium',
  status public.fraud_flag_status not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  resolution_notes text
);

create index fraud_flags_subject_idx on public.fraud_flags (subject_type, subject_id);
create index fraud_flags_open_idx on public.fraud_flags (status) where status in ('open', 'reviewing');

create table public.rate_limit_counters (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (key, window_start)
);

-- ========================================================================
-- TRANSVERSE
-- ========================================================================

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
-- TRIGGER : profil + rôle passager + fiche passager créés à l'inscription
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
  insert into public.passengers (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Génère un code de parrainage court et lisible à la création de la fiche
-- passager — jamais fourni par le client (colonne non accordée en écriture,
-- voir grants ci-dessous).
create or replace function public.generate_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.referral_code is null then
    new.referral_code := upper(regexp_replace(encode(extensions.gen_random_bytes(6), 'base64'), '[^a-zA-Z0-9]', '', 'g'));
    new.referral_code := left(new.referral_code, 6);
  end if;
  return new;
end;
$$;

create trigger passengers_referral_code
  before insert on public.passengers
  for each row execute function public.generate_referral_code();

-- ========================================================================
-- RLS
-- ========================================================================

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.admin_roles enable row level security;
alter table public.passengers enable row level security;
alter table public.zones enable row level security;
alter table public.drivers enable row level security;
alter table public.driver_documents enable row level security;
alter table public.vehicles enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.subscriptions enable row level security;
alter table public.promotions enable row level security;
alter table public.promotion_redemptions enable row level security;
alter table public.settlements enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.rides enable row level security;
alter table public.ride_offers enable row level security;
alter table public.ride_status_history enable row level security;
alter table public.invoices enable row level security;
alter table public.driver_locations enable row level security;
alter table public.ratings enable row level security;
alter table public.reports enable row level security;
alter table public.sos_alerts enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.device_fingerprints enable row level security;
alter table public.fraud_flags enable row level security;
alter table public.rate_limit_counters enable row level security;
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

-- passengers : chacun lit/édite le sien (hors compteurs de réputation et
-- code de parrainage, réservés au trigger/RPC) ; jamais visible par un
-- chauffeur ou un autre passager.
revoke all on public.passengers from authenticated, anon;
grant select on public.passengers to authenticated;
grant update (preferred_payment_method) on public.passengers to authenticated;

create policy passengers_select on public.passengers for select using (
  auth.uid() = id or private.has_admin_role(array['super_admin', 'admin', 'support', 'finance']::public.admin_role[])
);
create policy passengers_update_own on public.passengers for update using (auth.uid() = id);

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
-- infos publiques passeront par une fonction dédiée). Aucun accès en
-- écriture directe sur la création/catégorie : `submit_driver_application`
-- (SECURITY DEFINER, migration 2) est le seul point d'entrée, elle n'a pas
-- besoin de grant/policy d'insertion cliente. Le chauffeur ne peut modifier
-- en direct que sa disponibilité et sa position ; `status`, `category` et
-- les compteurs de réputation ne sont modifiables que par les RPC/Edge
-- Functions (clé de service), jamais en direct.
revoke all on public.drivers from authenticated, anon;
grant select on public.drivers to authenticated;
grant update (is_available, current_location, last_location_at) on public.drivers to authenticated;

create policy drivers_select on public.drivers for select using (
  auth.uid() = id or private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[])
);
create policy drivers_update_own on public.drivers for update using (auth.uid() = id) with check (auth.uid() = id);

-- driver_documents : le chauffeur soumet (statut toujours 'pending' par
-- défaut, colonnes de décision non accordées) ; la décision d'approbation/
-- rejet est réservée à la RPC admin (trace d'audit obligatoire).
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

-- payments, payment_webhook_events, subscriptions : lecture seule côté
-- client — toute écriture passe par les RPC/Edge Functions (clé de
-- service), voir docs/10-paiements.md et docs/09-abonnement.md.
revoke all on public.payments from authenticated, anon;
grant select on public.payments to authenticated;

create policy payments_select on public.payments for select using (
  user_id = auth.uid()
  or (ride_id is not null and exists (select 1 from public.rides r where r.id = payments.ride_id and r.driver_id = auth.uid()))
  or private.has_admin_role(array['super_admin', 'admin', 'finance']::public.admin_role[])
);

revoke all on public.payment_webhook_events from authenticated, anon;
grant select on public.payment_webhook_events to authenticated;

create policy payment_webhook_events_select_admin on public.payment_webhook_events for select using (
  private.has_admin_role(array['super_admin', 'finance']::public.admin_role[])
);

revoke all on public.subscriptions from authenticated, anon;
grant select on public.subscriptions to authenticated;

create policy subscriptions_select on public.subscriptions for select using (
  driver_id = auth.uid() or private.has_admin_role(array['super_admin', 'admin', 'finance']::public.admin_role[])
);

-- promotions : jamais listées en clair au client (éviterait l'énumération
-- des codes) — la validation d'un code saisi passe par une RPC dédiée qui
-- ne renvoie que le résultat, voir migration 2.
revoke all on public.promotions from authenticated, anon;
grant select, insert, update on public.promotions to authenticated;

create policy promotions_select_admin on public.promotions for select using (
  private.has_admin_role(array['super_admin', 'admin', 'finance']::public.admin_role[])
);
create policy promotions_write_admin on public.promotions for insert with check (
  private.has_admin_role(array['super_admin', 'admin']::public.admin_role[])
);
create policy promotions_update_admin on public.promotions for update using (
  private.has_admin_role(array['super_admin', 'admin']::public.admin_role[])
);

revoke all on public.promotion_redemptions from authenticated, anon;
grant select on public.promotion_redemptions to authenticated;

create policy promotion_redemptions_select on public.promotion_redemptions for select using (
  user_id = auth.uid() or private.has_admin_role(array['super_admin', 'admin', 'finance']::public.admin_role[])
);

-- settlements : le chauffeur voit ses propres règlements ; aucune écriture
-- cliente — passe par une RPC admin/finance dédiée (migration 2).
revoke all on public.settlements from authenticated, anon;
grant select on public.settlements to authenticated;

create policy settlements_select on public.settlements for select using (
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

-- rides, ride_offers, ride_status_history : aucune écriture cliente directe
-- — passe par create_ride_request, respond_to_ride_offer, etc. (RPC
-- SECURITY DEFINER, migration 2).
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

revoke all on public.ride_status_history from authenticated, anon;
grant select on public.ride_status_history to authenticated;

create policy ride_status_history_select on public.ride_status_history for select using (
  exists (
    select 1 from public.rides r
    where r.id = ride_id and (r.passenger_id = auth.uid() or r.driver_id = auth.uid())
  )
  or private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[])
);

-- invoices : visible par le passager et le chauffeur concernés ; aucune
-- écriture cliente — générées uniquement par le trigger de facturation
-- (migration 2), jamais à la main.
revoke all on public.invoices from authenticated, anon;
grant select on public.invoices to authenticated;

create policy invoices_select on public.invoices for select using (
  passenger_id = auth.uid() or driver_id = auth.uid()
  or private.has_admin_role(array['super_admin', 'admin', 'finance']::public.admin_role[])
);

-- driver_locations : écriture directe par le chauffeur assigné (simple
-- flux de position, la vérification d'anomalie GPS se fait après coup en
-- tâche planifiée — voir migration 2).
revoke all on public.driver_locations from authenticated, anon;
grant select, insert on public.driver_locations to authenticated;

create policy driver_locations_select on public.driver_locations for select using (
  driver_id = auth.uid()
  or (ride_id is not null and exists (select 1 from public.rides r where r.id = ride_id and r.passenger_id = auth.uid()))
  or private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[])
);
create policy driver_locations_insert_own on public.driver_locations for insert with check (driver_id = auth.uid());

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
-- résolution est réservée à la RPC admin (trace d'audit).
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

-- support_tickets/messages : chacun crée et suit les siens ; le staff
-- support voit tout. La résolution/l'affectation passe par la RPC admin.
revoke all on public.support_tickets from authenticated, anon;
grant select, insert on public.support_tickets to authenticated;

create policy support_tickets_select on public.support_tickets for select using (
  user_id = auth.uid() or private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[])
);
create policy support_tickets_insert_own on public.support_tickets for insert with check (user_id = auth.uid());

revoke all on public.support_ticket_messages from authenticated, anon;
grant select, insert on public.support_ticket_messages to authenticated;

create policy support_ticket_messages_select on public.support_ticket_messages for select using (
  exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
  or private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[])
);
create policy support_ticket_messages_insert on public.support_ticket_messages for insert with check (
  sender_id = auth.uid()
  and (
    (sender_type = 'user' and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()))
    or (sender_type = 'staff' and private.has_admin_role(array['super_admin', 'admin', 'support']::public.admin_role[]))
  )
);

-- device_fingerprints : le client déclare ses propres appareils ; seul le
-- staff admin (anti-fraude) et le système (trigger) lisent l'ensemble.
revoke all on public.device_fingerprints from authenticated, anon;
grant select, insert on public.device_fingerprints to authenticated;

create policy device_fingerprints_select on public.device_fingerprints for select using (
  user_id = auth.uid() or private.has_admin_role(array['super_admin', 'admin']::public.admin_role[])
);
create policy device_fingerprints_insert_own on public.device_fingerprints for insert with check (user_id = auth.uid());

-- fraud_flags, rate_limit_counters : aucun accès client, ni en lecture ni
-- en écriture pour rate_limit_counters (purement interne) ; lecture admin
-- seule pour fraud_flags, écriture réservée aux fonctions serveur.
revoke all on public.fraud_flags from authenticated, anon;
grant select on public.fraud_flags to authenticated;

create policy fraud_flags_select_admin on public.fraud_flags for select using (
  private.has_admin_role(array['super_admin', 'admin']::public.admin_role[])
);

revoke all on public.rate_limit_counters from authenticated, anon;

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

insert into public.subscription_plans (code, name, category, duration_hours, price_fcfa, is_active, sort_order) values
  ('pass_jour_car', 'Pass Jour — Voiture', 'car', 24, 1000, true, 1),
  ('pass_jour_moto', 'Pass Jour — Moto-taxi', 'moto', 24, 500, true, 2),
  ('pass_7j_car', 'Pass 7 jours — Voiture', 'car', 168, null, false, 3),
  ('pass_7j_moto', 'Pass 7 jours — Moto-taxi', 'moto', 168, null, false, 4),
  ('pass_30j_car', 'Pass 30 jours — Voiture', 'car', 720, null, false, 5),
  ('pass_30j_moto', 'Pass 30 jours — Moto-taxi', 'moto', 720, null, false, 6);
