# VTC Togo

Plateforme VTC pour le marché togolais, deux catégories parallèles —
**voiture (VTC)** et **moto-taxi** — avec deux revenus distincts, jamais
mélangés : un **abonnement à durée fixe** (Pass Jour — 24 h, 1 000 FCFA
voiture / 300 FCFA moto-taxi) pour recevoir des courses, et des **frais de
service de plateforme** de 2,5 % sur chaque course (jamais une commission
sur le prix payé par le passager — voir
[docs/01-architecture-fonctionnelle.md](docs/01-architecture-fonctionnelle.md)).
Lancement prévu à Lomé, extension progressive au reste du Togo.

> **État réel du projet, à lire avant toute tâche** :
> [`docs/STATUS.md`](docs/STATUS.md) (instantané court, jamais un journal).
> Tâches en cours : [`docs/TASKS.md`](docs/TASKS.md). Historique complet et
> daté : [`docs/CHANGELOG.md`](docs/CHANGELOG.md). Pourquoi certains choix
> ont été faits : [`docs/DECISIONS.md`](docs/DECISIONS.md). Règles
> permanentes de travail sur ce dépôt : [`CLAUDE.md`](CLAUDE.md).

## Sommaire des livrables de cadrage (`docs/`)

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
| 13 | [Glossaire](docs/13-glossaire.md) |

## Audits (6 septembre 2026)

Suite de 12 audits indépendants (production, sécurité web, sécurité
Supabase, architecture, tests, performance, UX/accessibilité, hardening
VPS, sauvegardes/DR, mode développeur autonome, SEO, documentation) —
verdicts, preuves et plans de remédiation détaillés dans
[`docs/audits/00-pipeline.md`](docs/audits/00-pipeline.md). Trouvaille la
plus importante à ce jour : le projet Supabase est sur le plan Free, donc
**sans aucune sauvegarde** — voir
[`docs/audits/09-audit-backups-monitoring-dr.md`](docs/audits/09-audit-backups-monitoring-dr.md)
et `TASK-054`.

## Stack (détail et justification en doc 02)

Supabase (Postgres + PostGIS, Auth par code email, Realtime, Storage, Edge
Functions) · React 19 + Vite (web, dashboard admin) · React Native/Expo
(mobile, passager + chauffeur) · Google Maps Platform · Mobile Money
(fournisseur non encore choisi, voir doc 10). SMS OTP abandonné (voir doc
02 §Révision authentification) — fournisseur à choisir si réintroduit.

## Structure du dépôt

```
apps/
  web/          # passager + chauffeur (React 19 + Vite + TanStack Router) — voir apps/web/README.md
  admin/        # dashboard équipe (24 écrans) — voir apps/admin/README.md
  mobile/       # Expo, Android + iOS, même périmètre que web — voir apps/mobile/README.md
supabase/
  migrations/   # schéma + logique métier SQL, source de vérité (doc 06/07) — déployées pour de vrai
  functions/    # 5 Edge Functions (doc 07) — écrites, vérifiées et déployées sur le vrai projet
services/
  matching-worker/  # écrit et testé en local, jamais déployé — remplacé pour l'instant par un
                     # balayage pg_cron interne à Supabase (voir docs/DECISIONS.md)
docs/           # les 13 livrables de cadrage + suivi de projet (STATUS/TASKS/CHANGELOG/DECISIONS)
  audits/       # 12 audits indépendants (production, sécurité, perf, SEO, doc...) — voir docs/audits/00-pipeline.md
.github/workflows/  # vérification automatique (tsc + build + lint) à chaque envoi sur main
```

## Démarrage

Chaque application se lance indépendamment — voir son propre README pour
le détail (variables d'environnement, écrans construits) :
[`apps/web/README.md`](apps/web/README.md),
[`apps/admin/README.md`](apps/admin/README.md),
[`apps/mobile/README.md`](apps/mobile/README.md).

```sh
npm install                 # une fois, à la racine (workspaces npm)
npm run dev --workspace=apps/web     # ou apps/admin
cd apps/mobile && npx expo start     # mobile : scanner le QR code avec Expo Go
```

Base de données (déjà déployée sur le projet Supabase dédié — cette
commande sert à rejouer les migrations sur un autre projet, par exemple
pour un environnement de test) :

```sh
npx supabase login
npx supabase link --project-ref <ref-du-projet-supabase-dedie>
npx supabase db push
```

## Vérification

Une seule commande, à la racine, rejoue exactement ce que vérifie GitHub
Actions à chaque envoi (`tsc --noEmit`, build, `oxlint`) pour les trois
applications :

```sh
npm run verify              # web + admin + mobile
npm run verify:web          # une seule application
```

## Licence

Projet privé. Tous droits réservés.
