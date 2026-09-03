# 09 — Logique de l'abonnement chauffeur

## Principe

**Révisé le 3 septembre 2026** — l'abonnement n'est plus le seul revenu :
il coexiste avec les frais de service (2,5 %/course, voir
[10-paiements.md](10-paiements.md) et
[01-architecture-fonctionnelle.md](01-architecture-fonctionnelle.md)),
**deux revenus distincts, jamais mélangés**. Ce document ne couvre que
l'abonnement. Toute la logique doit garantir deux choses de façon
inattaquable : qu'un chauffeur non abonné (ou dont l'abonnement a expiré,
ou dont l'abonnement n'est pas de la bonne catégorie) ne reçoive **jamais**
de course, et que l'activation ne dépende jamais de la seule confiance dans
le client mobile.

## Plans

Deux catégories parallèles (`car`/`moto`, voir
[01-architecture-fonctionnelle.md](01-architecture-fonctionnelle.md)
§Deux catégories), chacune sa propre grille — **règle absolue, ne jamais
modifier ces deux prix sans instruction explicite** :

| Code | Catégorie | Durée | Prix | Actif au MVP |
|---|---|---|---|---|
| `pass_jour_car` | Voiture | 24 h | **1 000 FCFA** | Oui |
| `pass_jour_moto` | Moto-taxi | 24 h | **500 FCFA** | Oui |
| `pass_7j_car` | Voiture | 7 jours | à définir | Non — ligne présente en base, `is_active=false` |
| `pass_7j_moto` | Moto-taxi | 7 jours | à définir | Non — idem |
| `pass_30j_car` | Voiture | 30 jours | à définir | Non — idem |
| `pass_30j_moto` | Moto-taxi | 30 jours | à définir | Non — idem |

Les plans 7j/30j existent déjà dans `subscription_plans` dès le MVP
(`is_active=false`) : les activer plus tard est un changement de donnée
(`UPDATE ... SET is_active=true` + prix), jamais une migration de schéma.
`purchase_subscription()` refuse tout plan dont la catégorie ne correspond
pas à `drivers.category` de l'acheteur (`plan_category_mismatch`, testé
réellement) — un chauffeur voiture ne peut techniquement pas payer un plan
moto, ni l'inverse.

## Cycle de vie d'un abonnement

**Implémenté et testé** de bout en bout contre un Postgres local (achat →
confirmation manuelle → activation → expiration forcée → blocage
automatique du chauffeur) — voir `purchase_subscription`,
`confirm_subscription_payment`, `admin_manual_payment_confirm`,
`expire_subscriptions` dans la migration
`00000000000002_business_logic.sql`.

```
Achat (purchase_subscription, code promo optionnel) ─► payments(status='pending')
                                          │
              ┌───────────────────────────┴───────────────────────────┐
     Mode manuel (actif au MVP)                  Mode automatique (fournisseur à choisir)
     admin_manual_payment_confirm                 Edge Function payment-webhook-momo
              │                                                  │
              └───────────────────────────┬───────────────────────────┘
                                           │
                          confirm_subscription_payment (idempotente)
                                           │
                              ┌───────────┴───────────┐
                        succès                     échec
                              │                          │
              payments.status='success'      payments.status='failed'
                              │                    notif. chauffeur, réessayer
        subscriptions activé/prolongé :
          expires_at = max(expires_at actuel, now()) + duration_hours
          status = 'active'
                              │
              expire_subscriptions() — pg_cron, chaque minute
                              │
                  expires_at <= now() ?
                              │
                        status='expired'
                  driver.is_available = false
                     notification d'expiration
```

Le mode manuel n'est pas un raccourci de développement laissé de côté :
c'est le chemin **actuellement fonctionnel**, choisi tant qu'aucun
fournisseur Mobile Money n'est retenu (voir [10-paiements.md](10-paiements.md)).
Un code promo (`validate_promo_code`/table `promotions`) peut réduire le
montant à payer, en pourcentage ou en montant fixe — une utilisation par
code et par chauffeur.

Le webhook Mobile Money (`payment-webhook-momo`) est désormais partagé
avec le paiement de course (`payments.purpose='ride_fare'`, voir
[10-paiements.md](10-paiements.md) §Paiement de la course) — même
déduplication, même vérification de signature, mais deux fonctions de
confirmation aux effets différents (`confirm_subscription_payment` active
un abonnement, `confirm_ride_payment` calcule les frais de service et
déclenche une facture) : **toujours deux revenus distincts**, jamais
fusionnés même quand ils partagent l'infrastructure technique.

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
- **Historique conservé indéfiniment** (`subscriptions`, statuts
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
