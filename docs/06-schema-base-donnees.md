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
    ├──1:1── drivers (category: car|moto, définitive) ──1:N── driver_documents
    │            │
    │            ├──1:1── vehicles (véhicule actif)
    │            │
    │            ├──1:N── subscriptions ──N:1── subscription_plans (category: car|moto)
    │            │            │
    │            │            └──1:1── payments (purpose=driver_subscription) ──0:1── promotion_redemptions ──N:1── promotions
    │            │
    │            ├──1:N── driver_locations (position courante + historique, ride_id nul hors course)
    │            │
    │            └──1:N── settlements (règlement périodique des frais de service 2,5 %/course)
    │
    └──1:N── rides (en tant que passager, category: car|moto)  ──N:1── drivers (chauffeur assigné)
                  │
                  ├──1:N── ride_offers (journal du matching, filtré par category)
                  ├──1:N── ride_status_history (audit automatique, trigger)
                  ├──1:N── ratings (agrège sur drivers.rating_avg / passengers.rating_avg)
                  ├──0:1── invoices (générée automatiquement si completed + payment_status='success')
                  ├──0:1── settlements (via rides.settlement_id, une fois réglée par lot)
                  ├──0:N── reports, sos_alerts, support_tickets (+ support_ticket_messages)
                  └──0:N── driver_locations (ride_id renseigné)

zones ──1:N── pricing_rules (category: car|moto) ──0:N── rides (figé au moment de la commande)

admin_roles (staff, indépendant du flux passager/chauffeur)
device_fingerprints ──trigger──> fraud_flags (appareil partagé entre comptes)
rate_limit_counters (interne, jamais exposé)
audit_logs, notifications (transverses)
phone_verifications (interne, pré-inscription — Edge Functions uniquement)
```

**Deux catégories parallèles, jamais mélangées** (voir
[01-architecture-fonctionnelle.md](01-architecture-fonctionnelle.md)) :
`driver_category` (`car`|`moto`) est portée par `drivers`, `subscription_plans`,
`pricing_rules` et `rides` — chacune de ces quatre tables exige une
catégorie explicite (`not null`, aucune valeur par défaut), pour qu'un
chauffeur, un plan, une règle de prix ou une course appartienne toujours
sans ambiguïté à l'un des deux pools, jamais aux deux.

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
`id` (= `user_id`), `category` (`car`|`moto`, fixée à la soumission du
dossier par `submit_driver_application`, jamais réécrite ensuite — changer
de catégorie voudrait dire un autre véhicule/abonnement/tarif, pas un
simple champ), `status` (`pending_documents`|`pending_review`|
`approved`|`rejected`|`suspended`), `city`, `is_available`,
`current_location geography(Point,4326)` (cache rapide pour le matching),
`last_location_at`, `rating_avg`, `rating_count`, `total_rides`. Index
`GIST` sur `current_location`, index partiel sur les chauffeurs
`approved` + `is_available`. Aucun accès en écriture directe côté client
(ni `INSERT` ni les colonnes `status`/`category`) : `submit_driver_application`
(`SECURITY DEFINER`) est le seul point de création.

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
`subscription_plans.category` (`car`|`moto`) sépare les deux grilles —
6 plans en seed (`pass_jour_car` 1 000 FCFA, `pass_jour_moto` 500 FCFA,
actifs ; `pass_7j_car/moto`, `pass_30j_car/moto`, `is_active=false`).
`subscriptions` (renommée depuis le cadrage initial pour correspondre au
schéma cible) : `driver_id`, `plan_id`, `payment_id`, `started_at`,
`expires_at`, `status`. **Un seul abonnement `active` par chauffeur**
(index unique partiel, vérifié) — un achat pendant un abonnement actif
**prolonge** `expires_at` au lieu de créer un doublon.
`purchase_subscription()` refuse (`plan_category_mismatch`, testé) tout
plan dont la catégorie ne correspond pas à `drivers.category` de
l'acheteur — un chauffeur voiture ne peut pas payer un plan moto.

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

`zones` inchangée. `pricing_rules.category` (`car`|`moto`) sépare les deux
grilles de prix — chaque catégorie a sa propre `base_fare_fcfa`/
`price_per_km_fcfa`/`price_per_min_fcfa`/`minimum_fare_fcfa`.
`estimate_ride_fare(distance_km, duration_min, category, zone_id?)`
sélectionne la règle la plus spécifique **de la bonne catégorie** (zone
donnée, sinon règle globale `zone_id IS NULL`) et applique la majoration
nuit selon les horaires de la zone.

## Courses

### `rides`, `ride_offers`
`rides.category` (`car`|`moto`, fixée à la création, jamais modifiée)
détermine le pool de matching (`ride_offers` ne porte que des chauffeurs de
la même catégorie, voir [08-matching.md](08-matching.md)). Ajouts pour la
facturation/le règlement des frais de service : `payment_status`
(`pending`|`processing`|`success`|`failed`|`cancelled`|`refunded`, distinct
du statut de la course — reflète le règlement direct passager→chauffeur,
confirmé par le chauffeur à la fin de course), `platform_fee_fcfa` et
`driver_amount_fcfa` (calculés une seule fois par `complete_ride()` —
`platform_fee_fcfa = round(final_fare_fcfa * 0.025)`,
`driver_amount_fcfa = final_fare_fcfa - platform_fee_fcfa` — jamais
recalculés ensuite), `settlement_id` (nul tant que la créance de frais de
service n'a pas été rattachée à un règlement, voir `settlements`
ci-dessous). Statuts de course : `requested`, `searching`, `accepted`,
`driver_arriving`, `driver_arrived`, `in_progress`, `completed`,
`cancelled_by_passenger`, `cancelled_by_driver`, `cancelled_by_system`
(aucun chauffeur trouvé après élargissement du rayon — remplace l'ancien
`no_drivers_found`, qui n'était pas un statut terminal cohérent avec les
colonnes `cancelled_at`/`cancelled_by`/`cancellation_reason`).

### `ride_status_history`
**Nouveau** : journal complet et automatique de chaque changement de
statut d'une course (`ride_id`, `from_status`, `to_status`, `changed_by`,
`changed_at`, `metadata`), alimenté par un trigger sur `rides` — jamais
écrit à la main, donc jamais désynchronisé de la réalité. C'est la source
de vérité en cas de litige, indépendante de ce que l'application a
affiché à un instant donné.

## Facturation & règlement des frais de service (2,5 %/course)

**Nouveau** (révision du 3 septembre 2026, voir
[01-architecture-fonctionnelle.md](01-architecture-fonctionnelle.md)
§Comment les frais de service sont réellement perçus) — **implémenté et
vérifié** de bout en bout contre un Postgres local (course complétée →
frais calculés → facture générée automatiquement → règlement par lot →
marquage payé, y compris le rejet d'un double règlement sur la même
période).

### `invoices`
Une ligne par course facturable, générée **automatiquement** par le
trigger `generate_invoice_on_ride_success` dès que `rides.status =
'completed'` **et** `rides.payment_status = 'success'` — jamais écrite à
la main. `invoice_number` auto-généré (`VTC-<année>-<compteur>`),
`ride_id` unique (`on conflict do nothing` protège contre un
déclenchement redondant). Porte `transport_amount_fcfa` (=
`rides.driver_amount_fcfa`), `platform_fee_fcfa`, `total_fcfa` (=
`rides.final_fare_fcfa` — transport + frais de service, jamais un montant
supplémentaire facturé au passager), `payment_method`,
`payment_reference`. Le rendu PDF n'existe pas encore (voir
[10-paiements.md](10-paiements.md) §Facturation) — seule cette ligne de
données est produite au MVP.

### `settlements`
Le prix de la course reste réglé directement passager → chauffeur (voir
[10-paiements.md](10-paiements.md)) : les 2,5 % dus par le chauffeur
s'accumulent donc course par course (`rides.platform_fee_fcfa`) jusqu'à un
règlement périodique par lot. `admin_create_settlement(driver_id,
period_start, period_end)` regroupe toutes les courses `payment_status =
'success'` non encore rattachées (`settlement_id is null`) de la période
en une créance unique (`rides_count`, `gross_transport_fcfa`,
`platform_fees_fcfa`) et marque ces courses comme rattachées — rejoue la
même période après coup lève `no_unsettled_rides_in_period` plutôt que de
créer un doublon. `admin_mark_settlement_paid(settlement_id, method?)`
clôt le règlement (`status='settled'`, `settled_at`, `settled_by`).
Réservé au staff `finance`/`admin`/`super_admin`.

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
