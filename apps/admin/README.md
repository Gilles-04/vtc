# Dashboard Admin

Application web React 19 + Vite + TanStack Router. Construit à ce jour
(3 septembre 2026) : connexion staff, vue d'ensemble, chauffeurs/KYC,
liste + détail courses — pas encore les ~20 autres écrans documentés en
[`../../docs/05-ecrans.md`](../../docs/05-ecrans.md) §Dashboard Admin.

## Démarrage

```sh
cd apps/admin
cp .env.example .env   # renseigner VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev
```

`VITE_SUPABASE_PUBLISHABLE_KEY` est la clé publique (`sb_publishable_...`,
Project Settings → API) — jamais la clé secrète/service_role.

## Ce qui est construit

- `/login` — email + mot de passe (Supabase Auth), redirige vers `/` une
  fois connecté.
- `/` (protégée) — vue d'ensemble, appelle la RPC `admin_stats_overview()`
  et affiche les KPIs par section (courses, chauffeurs/abonnements,
  revenus — abonnement et frais de service **jamais fusionnés**,
  paiements, alertes).
- `/chauffeurs` (protégée) — liste des chauffeurs avec filtre par statut
  (par défaut : en attente de revue), catégorie, note, nombre de courses.
- `/chauffeurs/$driverId` (protégée) — détail chauffeur : profil, véhicule,
  documents KYC avec URL signée Storage (bucket privé `driver-documents`),
  décision par document (`admin_review_driver_document`) et décision
  globale du dossier (`admin_decide_driver_application`), toutes deux
  tracées dans `audit_logs` côté base.
- `/courses` (protégée) — liste des courses, filtre statut/catégorie/
  période/zone, passager et chauffeur affichés (identité résolue via
  l'embed `profiles` corrigé par la migration 7).
- `/courses/$rideId` (protégée) — détail course : trajet, montants
  (estimé/final, mode et statut de paiement), chronologie complète
  (`ride_status_history`).
- Garde de route : redirige vers `/login` si non connecté, vers `/` si
  déjà connecté et qu'on visite `/login`.

**Vérifié réellement** (Playwright/Chromium, pas seulement lu) : le
routage protégé fonctionne sur les six routes (redirection vers `/login`
confirmée par capture d'écran), le formulaire de connexion construit et
envoie une vraie requête vers l'endpoint Supabase Auth réel du projet
déployé (`POST https://<projet>.supabase.co/auth/v1/token?grant_type=password`),
et tous les écrans protégés se montent sans erreur JS (vérifié avec une
session simulée côté navigateur, capture d'écran à l'appui). La
confirmation de bout en bout (connexion réussie, données réelles
retournées par les requêtes/RPC) n'a **pas** pu être testée depuis cet
environnement — accès réseau vers `*.supabase.co` bloqué côté sandbox (voir
`docs/STATUS.md`) — à tester en lançant l'app en local sur votre machine,
ou une fois déployée quelque part.

## Premier compte admin (bootstrap)

Aucun compte staff n'existe encore. Avant de pouvoir vous connecter :

1. Dashboard Supabase → **Authentication → Users → Add user** — créez
   votre compte (email + mot de passe), notez l'UUID affiché.
2. **SQL Editor**, en remplaçant `UUID_ICI` :
   ```sql
   insert into public.admin_roles (user_id, role) values ('UUID_ICI', 'super_admin');
   ```
   (Aucune RPC ne permet de créer le premier `super_admin` — la policy RLS
   de `admin_roles` exige déjà d'être `super_admin` pour y écrire, par
   construction. Un premier compte doit donc être créé directement en SQL,
   une seule fois.)
3. Connectez-vous sur `/login` avec cet email/mot de passe.

## Ce qui manque encore

- Les autres écrans (utilisateurs, abonnements, paiements, facturation,
  règlements, tarification, zones, réclamations, fraude, carte live des
  courses — voir doc 05). La carte live dépend d'une décision
  cartographie non encore prise (Google Maps vs Mapbox, `docs/STATUS.md`
  §7).
- Gestion des comptes staff depuis l'interface (aujourd'hui : SQL direct).
- Déploiement (aucune cible choisie).
