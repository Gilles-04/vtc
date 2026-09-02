# 09 — Logique de l'abonnement chauffeur

## Principe

L'abonnement, pas la commission, est le moteur de revenu de la plateforme.
Toute la logique doit donc garantir deux choses de façon inattaquable :
qu'un chauffeur non abonné (ou dont l'abonnement a expiré) ne reçoive
**jamais** de course, et que l'activation ne dépende jamais de la seule
confiance dans le client mobile.

## Plans

| Code | Durée | Prix | Actif au MVP |
|---|---|---|---|
| `pass_jour` | 24 h | 1 500 FCFA | Oui |
| `pass_7j` | 7 jours | à définir | Non — ligne présente en base, `is_active=false` |
| `pass_30j` | 30 jours | à définir | Non — idem |

Les plans 7j/30j existent déjà dans `subscription_plans` dès le MVP
(`is_active=false`) : les activer plus tard est un changement de donnée
(`UPDATE ... SET is_active=true` + prix), jamais une migration de schéma.

## Cycle de vie d'un abonnement

```
Achat (purchase_subscription) ─► payments(status='pending')
                                          │
                          Webhook fournisseur + re-vérification API
                                          │
                              ┌───────────┴───────────┐
                        succès                     échec
                              │                          │
              payments.status='success'      payments.status='failed'
                              │                    notif. chauffeur, réessayer
        driver_subscriptions créé :
          started_at = now()
          expires_at = now() + duration_hours
          status = 'active'
                              │
              (tâche planifiée, chaque minute)
                              │
                  expires_at <= now() ?
                              │
                        status='expired'
                  driver.is_available = false
                     notification d'expiration
```

## Règles

- **Un seul abonnement `active` par chauffeur** — imposé par un index unique
  partiel (`WHERE status = 'active'`), pas seulement par la logique
  applicative. Acheter un nouveau pass alors qu'un abonnement actif est en
  cours **prolonge** l'abonnement existant (nouvelle `expires_at` = ancienne
  `expires_at` + durée du plan) plutôt que de créer un doublon en parallèle —
  évite qu'un chauffeur perde du temps payé en achetant trop tôt.
- **Vérification à chaque matching, pas de cache de longue durée** — voir
  [08-matching.md](08-matching.md) étape 0. L'affichage du temps restant côté
  app peut être local (décompte visuel), mais la décision d'inclure le
  chauffeur dans un dispatch est toujours une requête fraîche.
- **Activation uniquement après confirmation serveur** — jamais à la simple
  fermeture de l'écran de paiement côté app. Le même principe que MBONPLAN
  pour ses propres abonnements boutique : webhook + re-vérification API,
  déduplication par `event_key`.
- **Historique conservé indéfiniment** (`driver_subscriptions`, statuts
  `expired`/`cancelled` inclus) — nécessaire pour les statistiques admin et
  un futur programme de fidélité/tarif dégressif (hors MVP).
- **Affichage chauffeur** (`/abonnement`, `/accueil`) : statut actif/inactif,
  date de début, date d'expiration, temps restant (recalculé côté client à
  partir de `expires_at`, pas d'appel serveur répété), historique complet des
  abonnements passés.

## Interaction avec une course en cours

Un abonnement qui expire **pendant** une course déjà `accepted`/`in_progress`
ne l'interrompt pas — la course va à son terme normalement. Le chauffeur est
simplement absent du pool de matching pour toute nouvelle demande tant qu'il
n'a pas renouvelé. Interrompre une course en cours pour un motif
d'abonnement serait un dysfonctionnement, pas une règle de sécurité : le prix
du service déjà engagé doit être honoré.
