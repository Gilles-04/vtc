# 02 — Architecture technique

## Choix de stack et pourquoi

| Couche | Choix | Pourquoi |
|---|---|---|
| Données/Auth/Realtime/Storage | **Supabase** (Postgres + PostGIS) — projet dédié, séparé de celui de MBONPLAN | Auth OTP téléphone native, RLS pour l'isolation passager/chauffeur/admin, Realtime pour la position live et le dispatch de course, Storage pour les documents KYC, Edge Functions pour la logique serveur sensible (matching, paiements). Réduit drastiquement le temps de mise sur le marché du MVP. Reste du Postgres standard — pas d'enfermement propriétaire si une migration devient nécessaire plus tard. |
| App mobile (Android/iOS) | **React Native (Expo)**, un seul binaire pour les deux rôles (passager et chauffeur, bascule de mode dans l'app — révisé le 3 septembre 2026, voir §Révision ci-dessous) | Un seul code pour Android/iOS, écosystème mature, cible explicite « Android d'entrée/milieu de gamme » (§11 du cadrage) — Expo permet des builds légers et des mises à jour OTA sans repasser par le store pour les correctifs non natifs. |
| App Web (`apps/web`) | **React 19 + Vite + TanStack Router**, mêmes rôles que le mobile (passager et chauffeur) | Ajoutée le 3 septembre 2026 à la demande du porteur du projet : permet de commander une course sans smartphone (cybercafé, ordinateur partagé) — un vrai besoin au Togo, pas un simple confort. Même stack que le dashboard admin, code réutilisable (composants, client Supabase). |
| Dashboard admin | **React 19 + Vite + TanStack Router**, app web | Cohérent avec l'expérience déjà en place sur MBONPLAN, pas de besoin mobile pour l'admin. |
| Cartographie | **Google Maps Platform** (Maps SDK mobile, Places Autocomplete, Directions API, Geocoding) — voir alternative ci-dessous | Meilleure couverture d'adresses et de POI à Lomé qu'une alternative gratuite au lancement. Architecture conçue pour rester swappable (couche d'abstraction `lib/maps/`) — Mapbox reste l'option de repli si le coût par requête devient un problème à l'échelle. **Décision à confirmer avec vous** : nécessite une clé API facturée à l'usage. |
| Paiement Mobile Money | **Abstraction multi-fournisseur**, aucun fournisseur câblé au jour 1 | Aucun prestataire n'est encore choisi (Flooz/TMoney en direct, ou agrégateur type Semoa/CinetPay/PayGate). Voir [10-paiements.md](10-paiements.md) — le circuit `pending → success/failed` fonctionne dès le MVP en mode manuel/admin, comme MBONPLAN l'a fait pour son propre paiement. |
| SMS / OTP | **eSMS Africa (Verify API)** | Déjà en usage éprouvé en production togolaise sur MBONPLAN (délivrabilité correcte via l'API Verify dédiée, contrairement à l'envoi générique). Nécessite un compte/API key **distinct** de celui de MBONPLAN. |
| Notifications push | **Expo Push Notifications** (FCM sous le capot) | Intégré nativement à Expo, pas de configuration Firebase manuelle nécessaire pour démarrer. |
| Génération de reçus/factures | **jsPDF** | Cohérence avec l'écosystème déjà maîtrisé (MBONPLAN), léger côté client comme serveur. |

## Révision du 3 septembre 2026 : 4 plateformes, passager/chauffeur unifiés

Décision du porteur du projet, qui inverse un choix documenté plus haut
(garder les rôles strictement séparés « pour garder chaque interface
focalisée ») : désormais **4 livrables**, chacun couvrant passager et
chauffeur sauf l'admin :

1. **Web** (`apps/web`) — nouveau, répond au besoin de commander sans
   smartphone.
2. **Android** — binaire Expo, mode passager/chauffeur.
3. **iOS** — même code Expo que Android, binaire distinct côté stores.
4. **Admin** (`apps/admin`) — inchangé, équipe uniquement.

Android et iOS restent un seul code source (Expo produit les deux
binaires depuis `apps/mobile`) — ce n'est pas un cinquième chantier de
développement, seulement deux publications de store distinctes.
`apps/passenger`/`apps/driver` (scaffoldés séparément en phase de cadrage)
sont donc remplacés par `apps/mobile` avant que du code n'y soit écrit —
aucune perte, ils ne contenaient qu'un README chacun.

## Vue d'ensemble

```
                        ┌────────────────────────┐
                        │   Google Maps Platform  │
                        │  (Maps, Places, Direct.)│
                        └───────────▲─────────────┘
                                    │
┌────────────────┐  ┌──────────────┴──────────────┐  ┌────────────────┐
│   App Web       │  │         App Mobile           │  │  Dashboard      │
│ React + Vite    │  │   React Native (Expo)         │  │  Admin (Web)    │
│ passager+chauff. │  │   passager+chauffeur          │  │  React + Vite   │
└────────┬────────┘  └───────────────┬───────────────┘  └────────┬────────┘
         │  HTTPS                    │  HTTPS + Realtime WS       │  HTTPS
         └───────────────┬────────────┴──────────────────────────┘
                         ▼
              ┌──────────────────────────┐
              │        Supabase           │
              │  ── Postgres + PostGIS    │
              │  ── Auth (OTP téléphone)  │
              │  ── Realtime (channels)   │
              │  ── Storage (KYC, privé)  │
              │  ── Edge Functions (Deno) │
              │     • matching-engine      │
              │     • pricing-engine       │
              │     • payment-webhooks     │
              │     • subscription-cron    │
              └─────────────┬──────────────┘
                             │
                 ┌───────────┴───────────┐
                 │  Fournisseurs externes  │
                 │  • Mobile Money (TBD)   │
                 │  • eSMS Africa (OTP)    │
                 │  • Expo Push (FCM)      │
                 └────────────────────────┘
```

## Pourquoi Edge Functions et pas seulement le client + RLS

Trois traitements ne doivent **jamais** être décidés côté client, même avec
RLS strict, parce qu'ils demandent une vue globale ou une garantie
d'atomicité que le client ne peut pas fournir :

1. **Matching** — sélectionner et classer les chauffeurs, gérer le
   séquencement des offres et leur expiration : doit tourner côté serveur,
   déclenché à la création d'une course, indépendamment de la présence en
   ligne du passager.
2. **Tarification** — le prix affiché au passager doit être calculé et figé
   côté serveur au moment de la commande (`estimated_fare_locked_at`), jamais
   recalculé côté client, pour éviter toute manipulation.
3. **Paiement/abonnement** — la confirmation d'un paiement d'abonnement ne
   doit jamais activer l'abonnement uniquement sur la foi du retour client :
   confirmation par webhook fournisseur + re-vérification API, exactement le
   principe déjà validé sur MBONPLAN (`payment_webhook_events`).

## Monorepo

```
vtc/
├── apps/
│   ├── web/            # app web publique, passager + chauffeur
│   ├── mobile/         # app Expo (Android + iOS), passager + chauffeur
│   └── admin/          # dashboard web, équipe uniquement
├── packages/
│   ├── shared-types/  # types générés depuis le schéma Supabase
│   ├── api-client/    # client Supabase + fonctions typées communes
│   └── ui/            # composants partagés (thème, boutons, cartes de course...)
├── supabase/
│   ├── migrations/    # schéma SQL, source de vérité
│   └── functions/     # Edge Functions (matching, pricing, webhooks, cron)
└── docs/
```

Un chauffeur peut aussi être passager (compte unique, `user_roles` porte
déjà les deux rôles cumulables — schéma inchangé). Depuis la révision du
3 septembre 2026 (voir plus haut), web et mobile portent les deux rôles
dans un seul binaire par plateforme, avec une bascule de mode explicite à
la connexion (pas de mélange des deux dans un même écran — chaque mode
garde son propre jeu d'écrans, seul le point d'entrée est partagé).

## Scalabilité (100 → dizaines de milliers de chauffeurs)

- **Requêtes de proximité** : index `GIST` PostGIS sur la position des
  chauffeurs disponibles (`ST_DWithin`), pas de scan complet — tient à
  l'échelle tant que le volume par ville reste dans les ordres de grandeur
  d'un Postgres correctement dimensionné (des plateformes de bien plus grande
  taille tournent sur ce modèle).
- **Position temps réel** : diffusion par canal Realtime scoping par course
  (`ride:<id>`), jamais de broadcast global — le volume de messages reste
  proportionnel aux courses actives, pas au nombre total de chauffeurs.
- **Découplage par ville dès le schéma** (`zones`) : permet un jour de
  sharder ou migrer une ville isolément si un seul Postgres ne suffit plus,
  sans revoir le modèle de données.
- **Edge Functions sans état** : scalent horizontalement par nature (chaque
  invocation est indépendante), pas de serveur à dimensionner manuellement.
- **Ce qui devra être revisité au-delà du MVP** (documenté pour ne pas
  surprendre plus tard, non bloquant aujourd'hui) : passage à une file de
  messages dédiée (au lieu de `pg_cron`/triggers) si le volume de matching
  simultané devient très élevé ; réplicas Postgres en lecture pour les
  requêtes admin/statistiques une fois le volume important.
