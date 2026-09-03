# Dashboard Admin

Application web React 19 + Vite + TanStack Router. Les 24 écrans
documentés en [`../../docs/05-ecrans.md`](../../docs/05-ecrans.md)
§Dashboard Admin sont construits (certains regroupés — voir
[`docs/TASKS.md`](../../docs/TASKS.md) TASK-020/024/026 pour le détail
des choix de regroupement liste+détail+action en un seul écran).

## Démarrage

```sh
cd apps/admin
cp .env.example .env   # renseigner VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev
```

`VITE_SUPABASE_PUBLISHABLE_KEY` est la clé publique (`sb_publishable_...`,
Project Settings → API) — jamais la clé secrète/service_role.

## Écrans construits

| Route | Écran |
|---|---|
| `/login` | Connexion staff (email + mot de passe) |
| `/` | Vue d'ensemble (`admin_stats_overview`) |
| `/utilisateurs`, `/utilisateurs/$userId` | Utilisateurs — liste, détail, suspendre/réactiver |
| `/chauffeurs`, `/chauffeurs/$driverId` | Chauffeurs/KYC — liste, détail, décision documents + dossier |
| `/vehicules` | Véhicules — recherche par plaque |
| `/courses`, `/courses/$rideId` | Courses — liste, détail |
| `/paiements` | Paiements — liste + filtres |
| `/facturation` | Facturation — liste des factures |
| `/abonnements`, `/abonnements/plans` | Abonnements — liste des souscriptions, gestion des plans |
| `/reglements` | Règlements — liste, génération, marquer payé |
| `/zones` | Zones — liste, création, activer/désactiver |
| `/tarification` | Tarification — historique des règles de prix, nouvelle règle |
| `/reclamations` | Réclamations & SOS — file priorisée, résolution |
| `/fraude` | Fraude — file de revue, décision |
| `/statistiques` | Statistiques globales — revenus par jour, rétention chauffeurs |

Toutes les routes sauf `/login` sont protégées (redirection vers
`/login` si non connecté).

**Vérifié réellement** (Playwright/Chromium, pas seulement lu) : chaque
écran a été vérifié dans un vrai navigateur au fur et à mesure de sa
construction — routage protégé, rendu sans erreur JS, actions
d'écriture (formulaires, RPC) simulées côté réseau (réseau vers
`*.supabase.co` bloqué depuis le sandbox de développement — voir
`docs/STATUS.md`). Les écrans chauffeurs/courses/utilisateurs/véhicules
ont en plus été vérifiés avec de vraies données du projet réel (lues
via MCP). Confirmation bout-en-bout avec de vraies actions écrites
depuis une session connectée : pas encore faite (voir Bootstrap
ci-dessous).

## Premier compte admin (bootstrap)

**Fait** : `super_admin` inséré pour `abotchigilles@yahoo.fr` dans
`admin_roles` (voir `docs/TASKS.md` TASK-027). Ce compte existait déjà
en tant que compte passager (créé via le code email `/passager` dans
`apps/web`), pas via un formulaire email+mot de passe.

**Point d'attention** : `/login` utilise `signInWithPassword` —
`encrypted_password` est renseigné en base mais rien ne garantit qu'il
corresponde à un mot de passe connu (comportement standard Supabase pour
un compte créé par OTP). Si la connexion échoue : Dashboard Supabase →
**Authentication → Users** → ce compte → réinitialiser le mot de passe.

Pour un futur deuxième compte staff (aucune interface de gestion
n'existe encore, voir « Ce qui manque » ci-dessous) :

1. Dashboard Supabase → **Authentication → Users → Add user** — créez
   le compte (email + mot de passe), notez l'UUID affiché.
2. **SQL Editor**, en remplaçant `UUID_ICI` et `ROLE_ICI`
   (`super_admin`/`admin`/`support`/`finance`) :
   ```sql
   insert into public.admin_roles (user_id, role) values ('UUID_ICI', 'ROLE_ICI');
   ```
   (Aucune RPC ne permet cette écriture depuis l'interface — la policy
   RLS de `admin_roles` exige déjà d'être `super_admin` pour y écrire,
   par construction.)

## Ce qui manque encore

- **Confirmation bout-en-bout** des 24 écrans avec de vraies actions
  (créer, modifier, résoudre...) depuis une session admin réellement
  connectée — à faire en local ou une fois déployé, dès que la
  connexion fonctionne.
- Gestion des comptes staff depuis l'interface (aujourd'hui : SQL direct).
- Carte live des courses (écran #10 de doc 05, non repris dans le
  tableau ci-dessus) — dépend de la clé Google Maps (`docs/STATUS.md` §7).
- Barre de navigation à regrouper par domaine (14 entrées, passe sur
  deux lignes) — pas urgent.
- Déploiement (aucune cible choisie).
