# VTC Togo

Plateforme VTC pour le marché togolais, avec un modèle économique différent
d'Uber : le chauffeur paie un **abonnement à durée fixe** (Pass Jour — 24 h,
1 500 FCFA) pour recevoir des courses, plutôt qu'une commission prélevée sur
chaque course. Lancement prévu à Lomé, extension progressive au reste du
Togo.

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

Supabase (Postgres + PostGIS, Auth OTP, Realtime, Storage, Edge Functions) ·
React Native/Expo (app passager, app chauffeur) · React 19 + Vite (dashboard
admin) · Google Maps Platform · eSMS Africa (OTP) · Mobile Money (fournisseur
non encore choisi, voir doc 10).

## Structure du dépôt

```
apps/
  passenger/    # app Expo passager — non initialisée, voir docs/12-roadmap.md
  driver/       # app Expo chauffeur — non initialisée
  admin/        # dashboard web — non initialisé
packages/
  shared-types/ # types générés depuis le schéma Supabase
  api-client/   # client Supabase + fonctions typées communes
  ui/           # composants partagés passager/chauffeur
supabase/
  migrations/   # schéma SQL, source de vérité (voir doc 06)
  functions/    # Edge Functions (voir doc 07)
docs/           # les 12 livrables + suivi de projet
```

## Démarrage (base de données)

```sh
npx supabase login
npx supabase link --project-ref <ref-du-projet-supabase-dedie>
npx supabase db push
```

Le schéma initial (`supabase/migrations/00000000000001_schema_initial.sql`)
a été vérifié en local (Postgres 16 + PostGIS) avant d'être versionné :
application propre, RLS fonctionnelle, contrainte d'unicité sur les
abonnements actifs, colonnes sensibles protégées côté chauffeur — pas
seulement relu.

Le reste de la stack (apps mobiles, dashboard admin) démarre en Phase 0/1 de
la [roadmap](docs/12-roadmap.md), une fois les comptes fournisseurs
(Supabase, Google Maps, eSMS Africa, Expo/EAS) ouverts.

## Licence

Projet privé. Tous droits réservés.
