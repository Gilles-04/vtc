# Edge Functions

Cinq fonctions implémentées et vérifiées avec Deno réel (`deno check` +
`deno lint`, contre les vrais types `@supabase/supabase-js`, `npm:`
— voir `deno.json`/`deno.lock`) — mais **jamais déployées ni appelées
contre un vrai projet Supabase**, faute d'accès à un tel projet dans
cette session. À tester en conditions réelles dès la Phase 0 de
[`../../docs/12-roadmap.md`](../../docs/12-roadmap.md), `phone-verification-check`
en priorité (voir l'avertissement en tête de son fichier).

| Fonction | Déclenchée par | Rôle |
|---|---|---|
| `phone-verification-start` | Client (app passager/chauffeur) | Démarre la vérification eSMS Verify d'un numéro togolais |
| `phone-verification-check` | Client | Vérifie le code, crée/retrouve le compte, ouvre une session |
| `payment-webhook-momo` | Fournisseur Mobile Money | Confirme un paiement d'abonnement (signature + re-vérification, jamais confiance dans le seul webhook) |
| `pricing-directions` | Client | Distance/durée réelles (Google Directions) + prix (`estimate_ride_fare`) en un aller-retour |
| `push-notifications-dispatch` | Database Webhook sur `notifications` (INSERT) | Envoie la notification via Expo Push |

`_shared/` : client Supabase avec la clé de service (`supabase-admin.ts`),
en-têtes CORS communs (`cors.ts`).

## Ce qui n'est PAS ici

Le balayage des offres de course expirées (délai de 15 s, bien trop court
pour `pg_cron` ou une fonction planifiée Supabase) est un petit processus
à part, toujours actif — voir
[`../../services/matching-worker/`](../../services/matching-worker/README.md).
