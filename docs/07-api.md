# 07 — API nécessaires

Deux familles : **RPC Postgres** (`SECURITY DEFINER`, appelées directement
par les clients via le SDK Supabase — logique courte, transactionnelle) et
**Edge Functions** (Deno, pour les traitements qui appellent un service
externe ou orchestrent plusieurs étapes). Convention reprise de MBONPLAN.

## Auth (gérée par Supabase Auth + eSMS Verify, pas de RPC dédiée)

- Inscription/connexion : `supabase.auth.signInWithOtp({ phone })`
- Vérification : `supabase.auth.verifyOtp({ phone, token })`
- Le trigger `handle_new_user` crée `profiles` + `user_roles(passenger)` à la
  création de l'`auth.users`.

## RPC — Passager

| Fonction | Rôle |
|---|---|
| `estimate_ride_fare(pickup, dropoff)` | Calcule distance/durée (via Directions API côté Edge Function appelée en amont) et applique la règle de tarification active → renvoie l'estimation, ne crée rien |
| `create_ride_request(pickup, dropoff, payment_method, estimated_fare_id)` | Crée la course en `status='requested'`, déclenche la Edge Function `matching-engine` |
| `cancel_ride(ride_id, reason)` | Annule si statut encore annulable (`requested`→`arrived`), jamais après `in_progress` |
| `rate_ride(ride_id, rating, comment)` | Note le chauffeur, une fois la course `completed` |
| `create_report(ride_id?, category, description)` | Signalement |
| `trigger_sos(ride_id, lat, lng)` | Déclenche une alerte SOS, notifie l'admin en priorité |

## RPC — Chauffeur

| Fonction | Rôle |
|---|---|
| `submit_driver_application(profile, documents[], vehicle)` | Crée `drivers(status=pending_review)`, `driver_documents`, `vehicle` |
| `resubmit_driver_document(document_id, file_path)` | Remplace un document rejeté uniquement |
| `set_driver_availability(is_available)` | Refusé si pas d'abonnement actif (vérifié côté fonction, pas seulement côté UI) |
| `update_driver_location(lat, lng)` | Appelée en continu (throttlée côté client) ; alimente `drivers.current_location` + diffusion Realtime |
| `respond_to_ride_offer(offer_id, accept: bool)` | Accepte/refuse une offre — voir [08-matching.md](08-matching.md) |
| `mark_driver_arrived(ride_id)` | `status='arrived'` |
| `start_ride(ride_id)` | `status='in_progress'`, tolérance de proximité GPS vérifiée côté serveur |
| `complete_ride(ride_id, final_distance_km, final_duration_min)` | Calcule `final_fare_fcfa`, `status='completed'` |
| `purchase_subscription(plan_id, provider)` | Crée `payments(status=pending)` + initie la transaction Mobile Money (Edge Function) |

## RPC — Admin (toutes vérifient `admin_roles` en interne)

| Fonction | Rôle |
|---|---|
| `admin_review_driver_document(document_id, decision, reason?)` | Approuve/rejette un document |
| `admin_decide_driver_application(driver_id, decision, reason?)` | Décision globale du dossier |
| `admin_suspend_user(user_id, reason)` / `admin_unsuspend_user(user_id)` | |
| `admin_update_pricing_rule(zone_id?, ...)` | Insère une nouvelle version, ne modifie jamais l'existante |
| `admin_manage_subscription_plan(plan_id?, ...)` | CRUD plans |
| `admin_resolve_report(report_id, resolution_notes)` / `admin_resolve_sos(sos_id)` | |
| `admin_manual_payment_confirm(payment_id)` | Confirmation manuelle (mode dégradé sans fournisseur actif — identique au principe validé sur MBONPLAN) |
| `admin_stats_overview(period)` | Agrégats revenus/courses/croissance |

## Edge Functions

| Fonction | Déclenchement | Rôle |
|---|---|---|
| `matching-engine` | Trigger DB (insert sur `rides` en `requested`) ou appel direct | Implémente l'algorithme complet — [08-matching.md](08-matching.md) |
| `ride-offer-timeout` | `pg_cron`, toutes les 5-10 s | Expire les offres `pending` dépassant leur délai, relance `matching-engine` pour l'offre suivante |
| `pricing-directions` | Appelée par `estimate_ride_fare` | Interroge Directions API (distance/durée réelles), isole la clé API côté serveur |
| `payment-webhook-momo` | Webhook du/des fournisseur(s) Mobile Money | Vérifie la signature, déduplique par `event_key`, confirme le paiement après re-vérification API — jamais sur la seule foi du payload |
| `subscription-expiry-cron` | `pg_cron`, toutes les minutes | Passe les abonnements expirés en `status='expired'`, coupe `is_available`, notifie |
| `sms-verify-webhook` | eSMS (si applicable) | Selon le flux OTP retenu (cf. MBONPLAN : Verify API gère la vérification elle-même côté fournisseur) |
| `push-notifications-dispatch` | Trigger DB sur `notifications` | Envoie via Expo Push |

## Realtime (canaux, pas de HTTP)

| Canal | Portée | Contenu |
|---|---|---|
| `ride:<ride_id>` | Passager + chauffeur assigné + admin | Position chauffeur, changements de statut de la course |
| `driver-offers:<driver_id>` | Le chauffeur concerné uniquement | Nouvelles offres de course, expirations |
| `admin-live-rides` | Staff admin | Vue agrégée de toutes les courses actives (carte live) |
