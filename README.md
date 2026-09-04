# VTC Togo

Plateforme VTC pour le marché togolais, deux catégories parallèles —
**voiture (VTC)** et **moto-taxi** — avec deux revenus distincts, jamais
mélangés : un **abonnement à durée fixe** (Pass Jour — 24 h, 1 000 FCFA
voiture / 300 FCFA moto-taxi) pour recevoir des courses, et des **frais de
service de plateforme** de 2,5 % sur chaque course (jamais une commission
sur le prix payé par le passager — voir
[docs/01-architecture-fonctionnelle.md](docs/01-architecture-fonctionnelle.md)).
Lancement prévu à Lomé, extension progressive au reste du Togo.

> **Avant de développer quoi que ce soit, lire les 12 livrables de cadrage
> dans [`docs/`](docs/)** — architecture fonctionnelle et technique,
> sitemap, parcours utilisateur, écrans, schéma de base de données, API,
> logique du matching/abonnement/paiement, sécurité, roadmap. Point d'entrée
> de continuité entre sessions : [`docs/STATUS.md`](docs/STATUS.md).

## Sommaire des livrables

| # | Document |
|---|---|
| 1 | [Architecture fonctionnelle](docs/01-architecture-fonctionnelle.md) |
| 2 | [Architecture technique](docs/02-architecture-technique.md) |
| 3 | [Sitemap](docs/03-sitemap.md) |
| 4 | [Parcours utilisateur](docs/04-parcours-utilisateur.md) |
| 5 | [Liste des écrans](docs/05-ecrans.md) |
| 6 | [Schéma de base de données](docs/06-schema-base-donnees.md) |
| 7 | [API nécessaires](docs/07-api.md) |
| 8 | [Logique du matching](docs/08-matching.md) |
| 9 | [Logique de l'abonnement](docs/09-abonnement.md) |
| 10 | [Logique des paiements](docs/10-paiements.md) |
| 11 | [Règles de sécurité](docs/11-securite.md) |
| 12 | [Roadmap de développement](docs/12-roadmap.md) |

## Stack (détail et justification en doc 02)

Supabase (Postgres + PostGIS, Auth par code email, Realtime, Storage, Edge
Functions) · React 19 + Vite (web, dashboard admin) · React Native/Expo
(mobile, passager + chauffeur) · Google Maps Platform · Mobile Money
(fournisseur non encore choisi, voir doc 10). SMS OTP abandonné (voir doc
02 §Révision authentification) — fournisseur à choisir si réintroduit.

## Structure du dépôt

```
apps/
  web/          # app web publique, passager + chauffeur — non initialisée (voir docs/02-architecture-technique.md §Révision du 3 septembre 2026)
  mobile/       # app Expo (Android + iOS), passager + chauffeur — non initialisée, voir docs/12-roadmap.md
  admin/        # dashboard web, équipe uniquement — connexion, vue d'ensemble, chauffeurs/KYC, courses construits, voir apps/admin/README.md
packages/
  shared-types/ # types générés depuis le schéma Supabase
  api-client/   # client Supabase + fonctions typées communes
  ui/           # composants partagés passager/chauffeur
supabase/
  migrations/   # schéma + logique métier SQL, source de vérité (doc 06/07)
  functions/    # 5 Edge Functions (doc 07) — écrites et vérifiées avec Deno,
                # jamais déployées faute de projet Supabase disponible
services/
  matching-worker/  # processus à part, toujours actif (doc 08 §Concurrence)
docs/           # les 12 livrables + suivi de projet
```

## Démarrage (base de données)

```sh
npx supabase login
npx supabase link --project-ref <ref-du-projet-supabase-dedie>
npx supabase db push
```

Les 5 migrations (`supabase/migrations/`) — schéma, logique métier (RPC,
triggers, `pg_cron`), vérification téléphone, jetons push, contournement
notifications push (voir `docs/STATUS.md`) — ont été **réellement testées**
en local (Postgres 16 + PostGIS) puis **déployées sur le vrai projet
Supabase dédié**, pas seulement relues : cycle complet d'une course
(création → matching → acceptation → trajet → fin → notation), abonnement
(achat → confirmation → expiration automatique → blocage du chauffeur),
KYC, anti-fraude (appareil partagé, anomalie GPS, limitation de débit),
suspension de compte, tickets support — 25 vérifications automatisées,
toutes passantes en local. Les 5 Edge Functions (`supabase/functions/`)
sont écrites, vérifiées avec Deno réel (compilation, typage contre les
vraies bibliothèques, lint) et **déployées sur le vrai projet** — URLs
vérifiées une par une. `push-notifications-dispatch` tourne déjà
réellement de bout en bout (notification de test → appel HTTP confirmé).
Le worker de dispatch (`services/matching-worker/`) est écrit, testé pour
de vrai contre un Postgres local, mais pas encore déployé (VPS + systemd).

Le dashboard admin (`apps/admin/`) a 5 écrans construits — voir
`docs/STATUS.md`. `apps/web/` a sa première page (accueil public). Le
reste (auth passager, apps mobiles) démarre en Phase 0/1 de la
[roadmap](docs/12-roadmap.md), une fois les comptes fournisseurs
restants (Google Maps, Expo/EAS) ouverts.

## Licence

Projet privé. Tous droits réservés.
