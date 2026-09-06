# Site Passager & Chauffeur

Application web React 19 + Vite + TanStack Router, deux rôles dans un
seul code (bascule au niveau des routes, pas de compte partagé) — voir
[`../../docs/02-architecture-technique.md`](../../docs/02-architecture-technique.md).

## Démarrage

```sh
cd apps/web
cp .env.example .env   # renseigner les 3 variables ci-dessous
npm install
npm run dev
```

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` — projet Supabase
  dédié, clé publique (`sb_publishable_...`, jamais la clé `service_role`).
- `VITE_GOOGLE_MAPS_API_KEY` — clé **client** (Places API (New) + Maps
  JavaScript API), restreinte par referrer HTTP. Ne pas confondre avec la
  clé **serveur** (`GOOGLE_MAPS_API_KEY`, Directions API, secret de
  l'Edge Function `pricing-directions` — jamais dans ce fichier).

Autres commandes : `npm run build` (compilation + build de production),
`npm run lint` (oxlint), `npm run preview` (sert le build local).

## Structure

```
src/
  pages/           # un fichier = un écran (routé par router.tsx)
  components/      # éléments transverses (SOS, Support, Notifications,
                    # Notation, Signalement, Profil, sélecteur de carte)
  lib/
    supabase.ts        # client Supabase
    types.ts           # types partagés entre les pages
    deviceFingerprint.ts, googleMaps.ts, pdf.ts, receipt.ts, invoice.ts,
    format.ts          # utilitaires par domaine (un fichier = un sujet)
router.tsx         # définition des routes + gardes de session
```

`apps/mobile` porte directement la même logique (mêmes RPC, mêmes
règles) vers React Native — les fichiers `components/` et `lib/types.ts`
sont aujourd'hui dupliqués entre les deux apps plutôt que partagés via
un package commun (`packages/`, jamais initialisé — voir
[`docs/STATUS.md`](../../docs/STATUS.md)).

## Écrans construits

Passager : onboarding, connexion par code email, demande de course
(catégorie, carte avec géolocalisation, estimation, paiement),
suivi de course, historique + facture, notation post-course, SOS,
signalement, notifications, support, profil.

Chauffeur : connexion par code email, dossier KYC + véhicule, tableau
de bord (abonnement, disponibilité, offres, course en cours), revenus +
historique + reçus PDF, mêmes écrans transverses que côté passager.

Détail complet et statut réel de chaque écran : voir
[`docs/STATUS.md`](../../docs/STATUS.md) et
[`docs/05-ecrans.md`](../../docs/05-ecrans.md).

## Vérification

`tsc --noEmit` / `npm run build` / `oxlint` systématiquement propres
avant chaque commit. Vérification par rendu réel (Chromium piloté par
Playwright, requêtes Supabase simulées) faite pour les écrans les plus
récents — voir `docs/TASKS.md` TASK-050 pour le détail de la méthode.
Jamais testé avec le vrai projet Supabase en réseau réel depuis cet
environnement de développement (accès bloqué) — à confirmer en local
ou une fois déployé.
