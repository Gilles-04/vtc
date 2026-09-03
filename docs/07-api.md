# 07 — API

Trois familles, toutes **réellement implémentées et testées** (pas de la
documentation d'intention) : **RPC Postgres** (`SECURITY DEFINER`,
exposées automatiquement en REST par PostgREST — c'est « l'API REST » de
l'architecture, voir [02-architecture-technique.md](02-architecture-technique.md)),
**Edge Functions** (Deno, vérifiées avec `deno check`/`deno lint` contre
les vrais types `@supabase/supabase-js` — jamais déployées faute de projet
Supabase disponible), et un **worker de dispatch** à part (voir plus bas).

Convention vérifiée dans le code (voir la migration
`00000000000002_business_logic.sql`) : une fonction sans `GRANT ... TO
authenticated` en fin de fichier n'est **pas** un point d'API — appel
direct par un client authentifié testé et confirmé refusé
(`permission denied`).

## Auth (Supabase Auth + eSMS Verify, pas de RPC dédiée pour l'inscription)

Le trigger `handle_new_user` crée `profiles` + `user_roles(passenger)` +
`passengers` à la création de l'`auth.users` (peu importe comment ce
compte a été créé). Voir §Vérification téléphone ci-dessous pour le flux
réel (le compte n'existe pas encore au moment de la demande de code).

## RPC — Passager

| Fonction | Rôle |
|---|---|
| `estimate_ride_fare(distance_km, duration_min, category, zone_id?)` | Calcule le prix à partir d'une distance/durée déjà connues et de la catégorie (`car`\|`moto` — chaque catégorie a sa propre grille de `pricing_rules`) ; utilisée en interne par `create_ride_request`/`complete_ride`, côté client passe plutôt par l'Edge Function `pricing-directions` qui calcule aussi la distance réelle |
| `create_ride_request(category, pickup, dropoff, adresses, distance_km, duration_min, payment_method, zone_id?)` | Crée la course (`status='searching'`) dans la catégorie choisie, déclenche `dispatch_next_offer` dans la même transaction — le pool de matching est filtré par catégorie, jamais mélangé |
| `cancel_ride(ride_id, reason?)` | Annule si statut encore annulable ; expire les offres en attente ; notifie l'autre partie |
| `create_support_ticket(category, subject, message, ride_id?)` | Ouvre un ticket + son premier message |
| `validate_promo_code(code)` | Vérifie un code (validité, expiration, quota, déjà utilisé) sans jamais lister les codes existants |
| `purchase_subscription(...)` / notation | Réservées au chauffeur / accès table direct — voir plus bas |
| `rate_ride` | Pas de RPC : `INSERT` direct dans `ratings`, RLS vérifie course terminée + appartenance (voir migration 1) |
| `trigger_sos` | Pas de RPC : `INSERT` direct dans `sos_alerts` (RLS `triggered_by = auth.uid()`), un trigger notifie tout le staff support/admin automatiquement |

## RPC — Chauffeur

| Fonction | Rôle |
|---|---|
| `submit_driver_application(category, city, marque, modèle, couleur, plaque, année?)` | Crée/complète `drivers` + `vehicles`, statut → `pending_review` ; `category` (`car`\|`moto`) est fixée ici, définitivement — jamais réécrite par une resoumission |
| `set_driver_availability(is_available)` | Refuse si non `approved` ou sans abonnement actif **dans sa catégorie** (message explicite ; le matching revérifie de toute façon, double sécurité) |
| `update_driver_location(lat, lng, accuracy?, ride_id?)` | Met à jour le cache + journalise dans `driver_locations` ; détecte une anomalie de vitesse GPS |
| `respond_to_ride_offer(offer_id, accept)` | Accepte (atomique, gère la concurrence) ou refuse (relance `dispatch_next_offer`) |
| `mark_driver_arrived(ride_id)` / `start_ride(ride_id)` | Transitions de statut, vérifient le chauffeur assigné et l'état précédent |
| `complete_ride(ride_id, distance_km, duration_min, payment_confirmed=true, provider='manual')` | Clôt la course. **Cash** : `payment_confirmed` décide tout de suite `payment_status='success'\|'failed'` et calcule `platform_fee_fcfa`/`driver_amount_fcfa`. **Mobile Money** : `payment_confirmed` ignoré — crée un `payments(purpose='ride_fare', status='pending')`, `rides.payment_status='processing'`, rien n'est calculé avant `confirm_ride_payment` |
| `purchase_subscription(plan_code, provider, promo_code?)` | Crée le paiement (`pending`), applique la réduction si code valide ; refuse (`plan_category_mismatch`) un plan dont la catégorie ne correspond pas à celle du chauffeur |
| `create_support_ticket(...)` | Identique au passager |

## RPC — Admin (toutes vérifient `private.has_admin_role()` en première ligne)

| Fonction | Rôle |
|---|---|
| `admin_review_driver_document(document_id, decision, reason?)` | Approuve/rejette un document, trace l'audit |
| `admin_decide_driver_application(driver_id, decision, reason?)` | Décision globale du dossier, notifie le chauffeur |
| `admin_manual_payment_confirm(payment_id)` / `admin_mark_payment_failed(payment_id, reason?)` | Mode manuel tant qu'aucun fournisseur Mobile Money n'est branché — `admin_mark_payment_failed` synchronise `rides.payment_status='failed'` quand le paiement est de type `ride_fare` (vérifié : jamais de course laissée en `'processing'` orphelin) |
| `admin_refund_payment(payment_id, reason?)` | Rembourse un paiement `success` (abonnement ou course) → `status='refunded'` ; pour une course, `rides.payment_status='refunded'` aussi (exclue automatiquement des agrégats `admin_stats_overview` filtrés sur `'success'`, vérifié) |
| `admin_suspend_user(user_id, reason)` / `admin_unsuspend_user(user_id)` | Bloque l'accès (vérifié : `create_ride_request` etc. refusent ensuite avec `account_suspended`) |
| `admin_resolve_report(...)` / `admin_resolve_sos(...)` / `admin_resolve_fraud_flag(...)` | Résolution avec trace d'audit systématique |
| `admin_assign_support_ticket(...)` / `admin_resolve_support_ticket(...)` | Gestion des tickets |
| `admin_stats_overview()` | Agrégats temps réel — **les deux revenus restent séparés dans la réponse**, jamais additionnés : courses/chauffeurs actifs/abonnements actifs par catégorie, revenu d'abonnement du jour par catégorie, frais de service du jour par catégorie, frais de service en attente de règlement, **reporting financier** (volume total des courses, paiements cash/Mobile Money du jour, paiements échoués du jour, remboursements du jour, montant net revenant aux chauffeurs du jour) |
| `admin_create_settlement(driver_id, period_start, period_end)` | Réservée `finance`/`admin`/`super_admin` : regroupe les courses réglées non rattachées de la période en une créance de frais de service (`settlements`), rattache ces courses ; échoue (`no_unsettled_rides_in_period`) si rien à régler |
| `admin_mark_settlement_paid(settlement_id, method?)` | Réservée `finance`/`admin`/`super_admin` : clôt un règlement (`status='settled'`) |

Zones/tarifs/plans/promotions : pas de RPC dédiée — `INSERT`/`UPDATE`
directs, RLS réservée aux rôles admin (voir migration 1) ; `pricing_rules`
en ajout seul (jamais de modification d'une règle déjà appliquée).

## Fonctions internes (jamais accordées à `authenticated`, vérifié)

| Fonction | Appelée par |
|---|---|
| `dispatch_next_offer(ride_id)` | En interne par `create_ride_request`/`respond_to_ride_offer`, jamais directement |
| `expire_ride_offers_and_dispatch()` | Le worker `services/matching-worker/`, toutes les ~5 s |
| `expire_subscriptions()` | `pg_cron`, chaque minute |
| `confirm_subscription_payment(payment_id, provider_ref)` | `admin_manual_payment_confirm` ou l'Edge Function `payment-webhook-momo` (clé de service) — idempotente |
| `confirm_ride_payment(payment_id, provider_ref, confirmed_amount_fcfa, expected_ride_id?)` | Uniquement l'Edge Function `payment-webhook-momo` (clé de service) — vérifie montant et `ride_id` avant d'activer, rejette un `transaction_id` déjà utilisé (contrainte base), idempotente ; calcule `platform_fee_fcfa`/`driver_amount_fcfa` et déclenche la facture |
| `cleanup_rate_limits()` | `pg_cron`, une fois par jour |
| `generate_invoice_on_ride_success()` | Trigger `AFTER UPDATE` sur `rides` (pas une fonction appelable) — génère la ligne `invoices` dès `status='completed' AND payment_status='success'`, jamais à la main |

## Vérification téléphone (avant inscription)

Le compte n'existe pas encore au moment de la demande de code : suivi par
**numéro** dans `phone_verifications` (table interne), pas par
utilisateur. Deux Edge Functions, jamais de RPC exposée côté client (le
`ESMS_AFRICA_API_KEY` ne doit jamais atteindre le client) :

| Edge Function | Rôle |
|---|---|
| `phone-verification-start` | Limite de débit, appelle eSMS Verify (`/verify/start`), enregistre le `verification_id` |
| `phone-verification-check` | Vérifie le code (`/verify/check`), crée le compte s'il n'existe pas (`find_user_id_by_phone`), ouvre une session (voir l'avertissement dans le fichier — mécanisme à revalider contre un vrai projet Supabase) |

## Edge Functions (Deno)

| Fonction | Déclenchement | Rôle |
|---|---|---|
| `payment-webhook-momo` | Webhook du fournisseur Mobile Money | Vérifie la signature HMAC, déduplique (`payment_webhook_events.event_key`), lit `payments.purpose` puis route vers `confirm_ride_payment` (course) ou `confirm_subscription_payment` (abonnement) ; un échec fournisseur synchronise `rides.payment_status='failed'` pour une course — la re-vérification API réelle reste à brancher une fois le fournisseur choisi (marqué `À ADAPTER` dans le code) |
| `pricing-directions` | Client, avant `create_ride_request` | Google Directions API (clé serveur) + `estimate_ride_fare` en un aller-retour |
| `push-notifications-dispatch` | Trigger `notifications_dispatch_push` sur `notifications` (INSERT), via `pg_net` — voir note ci-dessous | Envoie via Expo Push (lit `profiles.push_token`) |

**Déclenchement de `push-notifications-dispatch` — écart au plan initial** :
un vrai Database Webhook (fonctionnalité dashboard) n'a pas pu être créé
sur le projet Supabase réel (`ERROR: 3F000: schema "supabase_functions"
does not exist` — schéma normalement provisionné par défaut, absent sur ce
projet précis, `pg_net` lui-même bien présent). Contourné par un trigger
Postgres écrit à la main (`public.dispatch_push_notification()`,
migration `00000000000005_notifications_push_trigger.sql`) qui appelle
`net.http_post()` directement avec exactement le même format de payload
(`{type, table, record}`) qu'un vrai Database Webhook — la fonction
elle-même n'a donc nécessité aucune modification. **Vérifié réellement**
contre le projet Supabase déployé : une notification de test insérée a
bien déclenché un appel HTTP réel (`net._http_response` : `status_code
200`, réponse `{"ok":true,"skipped":"no_push_token"}` — comportement
attendu, l'utilisateur de test n'a pas de `push_token`).

## Worker de dispatch (pas une Edge Function)

`services/matching-worker/` — processus Node.js **toujours actif**,
appelle `expire_ride_offers_and_dispatch()` toutes les ~5 s. Nécessaire
car le délai d'une offre (15 s) est bien plus court que la granularité
minimale de `pg_cron`/des fonctions planifiées Supabase (1 minute) — voir
le README du worker pour le détail. **Vérifié réellement** : testé contre
un Postgres local avec une offre expirée artificiellement, balayage et
relance du dispatch confirmés.

## Realtime (canaux, pas de HTTP)

| Canal | Portée | Contenu |
|---|---|---|
| `ride:<ride_id>` | Passager + chauffeur assigné + admin | Position chauffeur, changements de statut |
| `driver-offers:<driver_id>` | Le chauffeur concerné | Nouvelles offres, expirations |
| `admin-live-rides` | Staff admin | Vue agrégée des courses actives |

Ces canaux Realtime s'appuient directement sur les tables déjà en place
(`rides`, `ride_offers`, `driver_locations`) — aucune configuration
supplémentaire côté schéma, à activer côté client au moment de
l'implémentation des apps (Phase 4).
