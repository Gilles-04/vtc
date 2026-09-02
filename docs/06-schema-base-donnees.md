# 06 — Schéma de base de données

Postgres (Supabase) + extension **PostGIS** (proximité chauffeurs, journal
de positions) et **pgcrypto** (`gen_random_bytes()`, codes de parrainage).
DDL complet et exécutable, **réellement testé** contre un Postgres 16 +
PostGIS local (pas seulement relu) :

- [`../supabase/migrations/00000000000001_schema_initial.sql`](../supabase/migrations/00000000000001_schema_initial.sql) — tables, enums, index, RLS
- [`../supabase/migrations/00000000000002_business_logic.sql`](../supabase/migrations/00000000000002_business_logic.sql) — fonctions RPC, triggers, tâches planifiées
- [`../supabase/migrations/00000000000003_phone_verification.sql`](../supabase/migrations/00000000000003_phone_verification.sql) — suivi de la vérification téléphone pré-inscription
- [`../supabase/migrations/00000000000004_push_tokens.sql`](../supabase/migrations/00000000000004_push_tokens.sql) — jeton de notification push

## Vue relationnelle simplifiée

```
auth.users ──1:1── profiles (= la table "users" fonctionnelle)
    │
    ├──1:N── user_roles (passenger | driver)
    ├──1:1── passengers ──1:1(auto)── (créée à l'inscription, avec code de parrainage)
    │
    ├──1:1── drivers ──1:N── driver_documents
    │            │
    │            ├──1:1── vehicles (véhicule actif)
    │            │
    │            ├──1:N── subscriptions ──N:1── subscription_plans
    │            │            │
    │            │            └──1:1── payments (purpose=driver_subscription) ──0:1── promotion_redemptions ──N:1── promotions
    │            │
    │            └──1:N── driver_locations (position courante + historique, ride_id nul hors course)
    │
    └──1:N── rides (en tant que passager)  ──N:1── drivers (chauffeur assigné)
                  │
                  ├──1:N── ride_offers (journal du matching)
                  ├──1:N── ride_status_history (audit automatique, trigger)
                  ├──1:N── ratings (agrège sur drivers.rating_avg / passengers.rating_avg)
                  ├──0:N── reports, sos_alerts, support_tickets (+ support_ticket_messages)
                  └──0:N── driver_locations (ride_id renseigné)

zones ──1:N── pricing_rules ──0:N── rides (figé au moment de la commande)

admin_roles (staff, indépendant du flux passager/chauffeur)
device_fingerprints ──trigger──> fraud_flags (appareil partagé entre comptes)
rate_limit_counters (interne, jamais exposé)
audit_logs, notifications (transverses)
phone_verifications (interne, pré-inscription — Edge Functions uniquement)
```

## Identité

### `profiles`
Miroir 1:1 de `auth.users` — c'est la table **« users »** de
l'architecture au sens fonctionnel : `id uuid PK` (= `auth.users.id`),
`phone`, `full_name`, `avatar_url`, `language`, `push_token` (jeton Expo,
un seul par compte au MVP), `is_suspended`, `suspended_reason`,
`created_at`. Aucune table `public.users` séparée : ce serait un doublon
pur sans donnée propre.

### `user_roles`, `admin_roles`
`user_roles(user_id, role)` — `passenger` (automatique à l'inscription) et
`driver` (à la soumission d'un dossier KYC), cumulables. `admin_roles`
totalement indépendant (staff, `super_admin`/`admin`/`support`/`finance`).

### `passengers`
Extension passager, créée automatiquement à l'inscription (même trigger
que `profiles`/`user_roles`) : `id` (= user id), `preferred_payment_method`,
`referral_code` (généré à la création), `referred_by`, `rating_avg`,
`rating_count`, `total_rides`.

## Chauffeur

### `drivers`
`id` (= `user_id`), `status` (`pending_documents`|`pending_review`|
`approved`|`rejected`|`suspended`), `city`, `is_available`,
`current_location geography(Point,4326)` (cache rapide pour le matching),
`last_location_at`, `rating_avg`, `rating_count`, `total_rides`. Index
`GIST` sur `current_location`, index partiel sur les chauffeurs
`approved` + `is_available`.

### `driver_documents`, `vehicles`
Inchangés depuis le cadrage initial — voir [01](01-architecture-fonctionnelle.md)/[05](05-ecrans.md).

### `driver_locations`
Table **unique** de suivi de position (remplace l'ancien duo
`ride_locations`/cache seul) : `driver_id`, `ride_id` **nullable**
(renseigné pendant une course, nul le reste du temps — position de fond
tant que le chauffeur est disponible), `location geography(Point,4326)`,
`accuracy_meters`, `recorded_at`. Alimentée par `update_driver_location()`
à chaque ping client, qui met aussi à jour le cache `drivers.current_location`
et détecte au passage une anomalie de vitesse (anti-fraude, voir plus bas).

## Abonnement & paiement

### `subscription_plans`, `subscriptions`
`subscriptions` (renommée depuis le cadrage initial pour correspondre au
schéma cible) : `driver_id`, `plan_id`, `payment_id`, `started_at`,
`expires_at`, `status`. **Un seul abonnement `active` par chauffeur**
(index unique partiel, vérifié) — un achat pendant un abonnement actif
**prolonge** `expires_at` au lieu de créer un doublon.

### `payments`, `payment_webhook_events`
Inchangés dans leur forme ; `payments.metadata` porte désormais
`{plan_id, plan_code}` au moment de l'achat, relu par
`confirm_subscription_payment()` pour savoir quelle durée accorder.

### `promotions`, `promotion_redemptions`
Codes de réduction sur l'abonnement uniquement (`applies_to='subscription'`
— la course elle-même n'est pas un flux financier plateforme, voir
[10-paiements.md](10-paiements.md), donc pas de promo dessus). Une
utilisation par code et par compte (contrainte unique), compteur
`redemptions_count` incrémenté automatiquement par trigger. Jamais listées
en clair au client : validation via la fonction `validate_promo_code()`.

## Tarification & zones

`zones`, `pricing_rules` inchangées — voir [01](01-architecture-fonctionnelle.md).
`estimate_ride_fare()` sélectionne la règle la plus spécifique (zone
donnée, sinon règle globale `zone_id IS NULL`) et applique la majoration
nuit selon les horaires de la zone.

## Courses

### `rides`, `ride_offers`
Inchangées dans leur forme depuis le cadrage initial.

### `ride_status_history`
**Nouveau** : journal complet et automatique de chaque changement de
statut d'une course (`ride_id`, `from_status`, `to_status`, `changed_by`,
`changed_at`, `metadata`), alimenté par un trigger sur `rides` — jamais
écrit à la main, donc jamais désynchronisé de la réalité. C'est la source
de vérité en cas de litige, indépendante de ce que l'application a
affiché à un instant donné.

## Confiance & sécurité

### `ratings`, `reports`, `sos_alerts`
Inchangées ; `ratings` alimente désormais automatiquement (trigger)
`drivers.rating_avg`/`rating_count` ou `passengers.rating_avg`/`rating_count`
selon qui note qui.

### `support_tickets`, `support_ticket_messages`
**Nouveau** : assistance générale (paiement, compte, document...),
distincte de `reports` (comportement lié à une course précise) et de
`sos_alerts` (urgence en cours de course). Un ticket porte un fil de
messages (`user`/`staff`), `status`/`priority`/`assigned_to`.

## Anti-fraude

Trois mécanismes complémentaires, détaillés en
[11-securite.md](11-securite.md) §Anti-fraude :

- **`device_fingerprints`** — un même appareil déclaré par plusieurs
  comptes distincts déclenche automatiquement un signalement (trigger).
- **`rate_limit_counters`** — limitation de débit à fenêtre fixe sur les
  actions sensibles (demande de course, achat d'abonnement, ticket
  support, demande de code SMS), table purement interne, jamais exposée.
- **`fraud_flags`** — file de revue centralisée (référence polymorphe
  `subject_type`/`subject_id`) : appareil partagé, anomalie de vitesse GPS
  (téléportation). Jamais de blocage automatique silencieux — toujours une
  décision humaine via `admin_resolve_fraud_flag()`.

## Transverse

`notifications`, `audit_logs` inchangées. `phone_verifications` (nouveau,
détaillé en [07-api.md](07-api.md) §Vérification téléphone) suit la
vérification d'un **numéro**, pas d'un utilisateur (le compte n'existe pas
encore au moment de la demande de code) — entièrement interne, jamais
accédée par un client, uniquement par les Edge Functions
`phone-verification-start`/`phone-verification-check` via la clé de
service.

## Sécurité au niveau des données

RLS activé sur **toutes** les tables sans exception, y compris les
nouvelles. Principe inchangé (voir [11-securite.md](11-securite.md)) :
tout ce qui touche à l'argent, au dispatch d'une course, ou qui exige une
trace d'audit, n'a **aucune** policy d'écriture cliente directe — RPC
`SECURITY DEFINER` uniquement, chacune vérifiant elle-même
`private.has_admin_role()` quand c'est une action de staff. Vérifié
concrètement (pas supposé) : une tentative d'appel direct d'une fonction
interne (`dispatch_next_offer`) par un client authentifié échoue bien avec
`permission denied`.
