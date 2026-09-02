# 06 — Schéma de base de données

Postgres (Supabase) + extension **PostGIS** (proximité chauffeurs) et
**pgcrypto** (jetons/`gen_random_bytes`, cf. leçon MBONPLAN : toujours
`SET search_path = public, extensions` sur les fonctions `SECURITY DEFINER`
qui en dépendent). DDL complet et exécutable :
[`../supabase/migrations/00000000000001_schema_initial.sql`](../supabase/migrations/00000000000001_schema_initial.sql).

## Vue relationnelle simplifiée

```
auth.users ──1:1── profiles
    │
    ├──1:N── user_roles (passenger | driver)
    │
    ├──1:1── drivers ──1:N── driver_documents
    │            │
    │            ├──1:1── vehicles (véhicule actif)
    │            │
    │            └──1:N── driver_subscriptions ──N:1── subscription_plans
    │                          │
    │                          └──1:1── payments (purpose=driver_subscription)
    │
    └──1:N── rides (en tant que passager)  ──N:1── drivers (en tant que chauffeur assigné)
                  │
                  ├──1:N── ride_offers (journal du matching)
                  ├──1:N── ride_locations (positions échantillonnées)
                  ├──1:N── ratings
                  ├──0:1── reports
                  └──0:N── sos_alerts

zones ──1:N── pricing_rules
zones ──1:N── rides (zone rattachée à la course, pour stats/nuit)

admin_roles (staff, indépendant du flux passager/chauffeur)
audit_logs (traçabilité transverse, toute action admin sensible)
notifications (transverse, tout utilisateur)
```

## Tables — détail

### `profiles`
Miroir 1:1 de `auth.users`. `id uuid PK` (= `auth.users.id`), `phone`,
`full_name`, `avatar_url`, `language` (`fr`/`en`), `is_suspended bool`,
`suspended_reason`, `created_at`.

### `user_roles`
`user_id`, `role` (`passenger`|`driver`). Un utilisateur peut cumuler les
deux — voir [11-securite.md](11-securite.md). `passenger` est attribué
automatiquement à la création du compte ; `driver` uniquement après
soumission d'un dossier KYC (indépendamment de sa validation).

### `drivers`
`id` (= `user_id`), `status` (`pending_documents`|`pending_review`|
`approved`|`rejected`|`suspended`), `city`, `is_available bool`,
`current_location geography(Point,4326)`, `last_location_at`,
`rating_avg numeric(2,1)`, `rating_count int`, `total_rides int`,
`created_at`. Index `GIST` sur `current_location`, filtré aux chauffeurs
`approved` + `is_available` + abonnement actif (vue matérialisée légère ou
index partiel — détail dans le SQL).

### `driver_documents`
`id`, `driver_id`, `doc_type` (`piece_identite`|`permis_conduire`|
`carte_transport`|`assurance`|`carte_grise`|`photo_vehicule`), `file_path`
(bucket privé `driver-documents`), `status` (`pending`|`approved`|
`rejected`), `rejection_reason`, `reviewed_by`, `reviewed_at`, `expires_at`,
`created_at`.

### `vehicles`
`id`, `driver_id` (unique — un véhicule actif par chauffeur au MVP), `brand`,
`model`, `color`, `plate_number` (unique), `year`, `photo_path`, `created_at`.

### `subscription_plans`
`id`, `code` (`pass_jour`|`pass_7j`|`pass_30j`), `name`, `duration_hours`,
`price_fcfa`, `is_active bool` (seul `pass_jour` actif au MVP),
`sort_order`.

### `driver_subscriptions`
`id`, `driver_id`, `plan_id`, `payment_id`, `started_at`, `expires_at`,
`status` (`active`|`expired`|`cancelled`). **Un seul abonnement `active` par
chauffeur à la fois** (contrainte applicative + index unique partiel) — voir
[09-abonnement.md](09-abonnement.md).

### `payments`
`id`, `user_id`, `purpose` (`driver_subscription` seul au MVP — enum
extensible), `amount_fcfa`, `provider` (`flooz`|`tmoney`|`manual`),
`provider_ref`, `status` (`pending`|`success`|`failed`|`refunded`),
`metadata jsonb`, `created_at`, `confirmed_at`.

### `payment_webhook_events`
`id`, `provider`, `event_key` (unique — déduplication), `payload jsonb`,
`payment_id`, `processed_at`. Reprend le principe déjà validé sur MBONPLAN :
jamais confiance dans le seul retour client, toujours confirmation par
webhook + re-vérification API.

### `zones`
`id`, `name`, `city`, `boundary geography(Polygon,4326)` (nullable au
lancement — Lomé traité comme zone unique sans polygone strict au MVP,
champ prêt pour un découpage plus fin), `night_start_time`,
`night_end_time`, `is_active`.

### `pricing_rules`
`id`, `zone_id` (nullable = règle globale par défaut), `base_fare_fcfa`,
`price_per_km_fcfa`, `price_per_min_fcfa`, `minimum_fare_fcfa`,
`night_multiplier_percent`, `effective_from`, `created_by`. Jamais
d'`UPDATE` sur une ligne existante consommée par une course : toute
modification insère une nouvelle ligne — voir [10-paiements.md](10-paiements.md)
et [12-roadmap.md](12-roadmap.md) pour la logique de figeage du prix.

### `rides`
`id`, `passenger_id`, `driver_id` (nullable jusqu'au matching), `status`
(`requested`|`searching`|`accepted`|`driver_arriving`|`arrived`|
`in_progress`|`completed`|`cancelled_by_passenger`|`cancelled_by_driver`|
`no_drivers_found`), `pickup_location geography(Point,4326)`,
`pickup_address`, `dropoff_location geography(Point,4326)`,
`dropoff_address`, `zone_id`, `pricing_rule_id` (figé au moment de la
commande), `estimated_distance_km`, `estimated_duration_min`,
`estimated_fare_fcfa`, `final_distance_km`, `final_duration_min`,
`final_fare_fcfa`, `payment_method` (`cash`|`mobile_money`),
`requested_at`, `matched_at`, `driver_arrived_at`, `started_at`,
`completed_at`, `cancelled_at`, `cancelled_by` (`passenger`|`driver`|
`system`), `cancellation_reason`.

### `ride_offers`
Journal du dispatch séquentiel — voir [08-matching.md](08-matching.md).
`id`, `ride_id`, `driver_id`, `rank`, `status` (`pending`|`accepted`|
`rejected`|`expired`), `sent_at`, `responded_at`, `expires_at`.

### `ride_locations`
Positions échantillonnées (pas chaque point GPS brut — throttlé côté client,
~1 point/5-10 s). `id`, `ride_id`, `driver_id`, `location geography(Point,4326)`,
`recorded_at`. Complément de la diffusion Realtime (qui, elle, n'est pas
persistée) — utile pour le litige/audit et la reconstruction d'un trajet.

### `ratings`
`id`, `ride_id`, `rater_id`, `ratee_id`, `rater_role` (`passenger`|`driver`
— qui note qui), `rating smallint` (1 à 5), `comment`, `created_at`. Un seul
avis par sens et par course (contrainte unique).

### `reports`
`id`, `ride_id` (nullable — un signalement peut concerner un compte hors
course), `reporter_id`, `reported_user_id`, `category`, `description`,
`status` (`open`|`investigating`|`resolved`|`dismissed`), `resolved_by`,
`resolved_at`, `resolution_notes`, `created_at`.

### `sos_alerts`
`id`, `ride_id`, `triggered_by`, `location geography(Point,4326)`,
`status` (`open`|`acknowledged`|`resolved`), `resolved_by`, `resolved_at`,
`created_at`. Priorité absolue dans l'UI admin — voir
[11-securite.md](11-securite.md).

### `notifications`
`id`, `user_id`, `type`, `title`, `body`, `data jsonb`, `sent_at`,
`read_at`.

### `admin_roles`
`user_id`, `role` (`super_admin`|`admin`|`support`|`finance`) — table
séparée du flux passager/chauffeur, gérée uniquement par `super_admin`.
Reprend la leçon MBONPLAN : les valeurs d'enum ne sont jamais supprimées,
seul le périmètre accordé par rôle (fonction `private.admin_scopes()`)
évolue.

### `audit_logs`
`id`, `actor_id`, `action`, `target_table`, `target_id`, `metadata jsonb`,
`created_at`. Toute décision admin sensible (validation KYC, suspension,
remboursement, modification tarifaire) y écrit une ligne.

## Sécurité au niveau des données

RLS activé sur **toutes** les tables, détail complet en
[11-securite.md](11-securite.md). Principe général : un passager ne voit que
ses propres courses/paiements/notes ; un chauffeur ne voit que son propre
dossier, ses offres de course et les courses où il est assigné ; le staff
admin voit large mais uniquement via des fonctions `SECURITY DEFINER` qui
vérifient explicitement `admin_roles`, jamais par une policy `USING (true)`.
