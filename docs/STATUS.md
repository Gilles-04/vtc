# État du projet — VTC Togo

*Dernière mise à jour : 3 septembre 2026 (nav admin regroupée par
domaine, README admin rafraîchi)*

> Instantané, pas un journal — réécrit à chaque mise à jour significative.

## 1. Où en est-on ?

Le backend (schéma, logique métier, module financier complet, deux
catégories voiture/moto-taxi) est **déployé pour de vrai** sur le projet
Supabase dédié : 12 migrations + 5 Edge Functions en place et vérifiées
(32 tables, 49 fonctions, 51 policies RLS, grants internes durcis).

**Le dashboard admin (`apps/admin/`) est complet** : les 24 écrans
documentés dans `docs/05-ecrans.md` sont construits (certains regroupés
— Règlements et Réclamations & SOS couvrent chacun liste+détail+action
en un seul écran, le détail ne justifiant pas une route séparée) —
connexion, vue d'ensemble, utilisateurs, chauffeurs/KYC, véhicules,
courses, paiements, facturation, abonnements (liste + plans),
règlements, zones, tarification, réclamations & SOS, fraude,
statistiques globales. Tous vérifiés dans un vrai navigateur
(Playwright/Chromium) : chauffeurs/courses/utilisateurs/véhicules avec
de vraies données du projet (démo + 2 vrais comptes créés par vous en
local, voir plus bas) ; le reste avec données et RPC/écritures simulées
côté réseau (ces tables sont vides sur le projet réel pour l'instant).
Confirmation avec de vraies requêtes réseau contre le projet réel : non
testée depuis cet environnement (réseau sandbox bloqué vers
`*.supabase.co`) — à faire en local chez vous.

**Auth passager confirmée en conditions réelles** : vous avez lancé
`apps/web` en local (`npm run dev`) et créé deux comptes via `/passager`
— le flux `signInWithOtp`/`verifyOtp` par email fonctionne réellement de
bout en bout hors sandbox. Les deux comptes sont visibles dans
`/utilisateurs` du dashboard admin (sans nom/téléphone, l'inscription
par email seul ne les renseigne pas — normal, pas un bug).

**4 livrables** (révision du 3 septembre 2026, détail dans
`docs/02-architecture-technique.md`) : Web, Android, iOS, Admin —
chacun couvrant passager **et** chauffeur sauf l'admin. Android/iOS
restent un seul code Expo (`apps/mobile`), pas encore démarré.

**`apps/web`** : page d'accueil publique + auth passager par email
construites et vérifiées (voir ci-dessus). `/chauffeur` reste un
placeholder. La demande de course (prochain chantier naturel) est
bloquée sur **deux points**, indépendants du choix cartographie
(Google Maps, déjà décidé) :
1. La **clé API Google Maps** elle-même, aucune fournie à ce jour (§7)
   — `pricing-directions` (Edge Function) attend déjà des coordonnées.
2. **`pricing_rules` est vide** sur le projet réel — `estimate_ride_fare`
   échoue tant qu'aucune règle n'existe pour une catégorie. Se règle en
   30 secondes via `/tarification` (dashboard admin) une fois connecté.

Un serveur **MCP Supabase** est connecté à cette session (accès direct au
projet réel — lecture, migrations, avis de sécurité) mais c'est un canal
séparé de la politique réseau du sandbox : le navigateur ne peut
toujours pas contacter `*.supabase.co` directement depuis cet
environnement.

Reste à construire : la demande de course dans `apps/web`, `apps/mobile`
(pas commencé), le worker de dispatch (écrit, pas déployé).

## 2. Ce qui fonctionne

**Base de données** (12 migrations, vérifiées en local puis déployées,
comptage confirmé identique) : cycle complet d'une course par catégorie
(matching, cash/Mobile Money), frais de service 2,5 % jamais mélangés à
l'abonnement, facturation/règlement/remboursement automatiques, reporting
financier complet (`admin_stats_overview`), KYC/anti-fraude/support
hérités. Migrations 9-12 ont corrigé le même bug d'embedding PostgREST
(FK manquante vers `profiles`) sur `payments`, `invoices`, `user_roles`,
`reports` et `sos_alerts` — toutes les tables qui en avaient besoin
jusqu'ici sont réglées.

**Dashboard admin complet** (`apps/admin/`) : voir §1. Code React 19 +
Vite + TanStack Router, même stack que `apps/web`.

**5 Edge Functions déployées** (`payment-webhook-momo`,
`phone-verification-start`/`-check`, `pricing-directions`,
`push-notifications-dispatch`) — URLs vérifiées. `push-notifications-dispatch`
tourne réellement de bout en bout via un trigger `pg_net` fait main
(Database Webhook natif cassé sur ce projet, contourné en migration 5).
`phone-verification-start`/`-check` non appelées depuis l'abandon d'eSMS
Africa — conservées, pas supprimées.

**Design** : 37 écrans (canvas Claude Design) — antérieur à la révision
du modèle économique et de l'architecture du 3 septembre ; ne reflète ni
les écrans catégorie/facturation/fraude ni le regroupement
passager+chauffeur par plateforme, ni les 24 écrans admin réels.

## 3. Ce qui pose problème / limites connues

- **Secrets Edge Functions pas tous configurés** : `PAYMENT_WEBHOOK_SECRET`
  (aucune dépendance externe) ; `GOOGLE_MAPS_API_KEY` en attente (§7).
  `ESMS_AFRICA_API_KEY` n'est plus à l'ordre du jour (abandonné).
- **Premier compte admin créé** (`abotchigilles@yahoo.fr`,
  `super_admin` inséré dans `admin_roles` via MCP) mais **mot de passe
  probablement inutilisable** : ce compte existait déjà comme compte
  passager (créé via `/passager`, code email — TASK-021), jamais via un
  formulaire email+mot de passe. `/login` (`apps/admin`) utilise
  `signInWithPassword` — réinitialiser le mot de passe depuis Dashboard
  → Authentication → Users si la connexion échoue. Non testable depuis
  ce sandbox (réseau bloqué).
- **Database Webhook natif Supabase cassé sur ce projet** — contourné
  pour `push-notifications-dispatch`, un futur besoin similaire
  rencontrera la même anomalie.
- **Custody des fonds Mobile Money d'une course, non tranchée** (détaillé
  dans [10-paiements.md](10-paiements.md) §Paiement de la course).
- **`phone-verification-check` non testée** — eSMS Africa abandonné,
  circuit en réserve pour un futur fournisseur SMS.
- **Rendu PDF de la facture non construit.**
- **Clé API Google Maps manquante** — bloque la demande de course.
- **`pricing_rules` vide sur le projet réel** — bloque aussi la demande
  de course, indépendamment de Google Maps (§1).
- **Mobile Money** : fournisseur non choisi (§7) — non bloquant, backend
  en mode manuel/admin.
- **Critère de fiabilité du matching non implémenté** (doc 08).
- **Protection mots de passe compromis (HaveIBeenPwned) désactivée** —
  interrupteur dashboard (Authentication → Password protection), pas une
  migration. Deux minutes, quand vous voulez.
Rien en cours — en attente de la prochaine demande.

## 5. Dernièrement terminé

**3 septembre 2026** — détail complet de chaque point dans
`docs/TASKS.md` (TASK-004 à TASK-028, une entrée par point) : **nav
admin regroupée par domaine** (14 liens plats → 6 entrées avec 4 menus
déroulants) **+ README admin rafraîchi** (était figé depuis TASK-006,
listait encore 6 routes sur 15) ; **premier compte admin bootstrappé**
(`super_admin` inséré pour `abotchigilles@yahoo.fr`, mot de passe
probablement à réinitialiser — voir §3) ; révision
du modèle économique (catégories, frais de service) ; module paiement/
abonnement/facturation ; déploiement réel du schéma (12 migrations) et
des 5 Edge Functions ; contournement `pg_net` pour les push ; **les 24
écrans du dashboard admin, un à un** (voir §1 pour la liste) ; bucket
Storage `driver-documents` ; correction récurrente d'un bug d'embedding
PostgREST (5 tables sur 5 migrations, 7 à 12) ; MCP Supabase connecté +
durcissement de 13 grants internes ; révision d'architecture
(4 plateformes) ; `apps/web` scaffoldé + auth passager par code email,
construite et confirmée en conditions réelles par vous, en local ; eSMS
Africa abandonné (documentation).

Antérieurement (2 septembre 2026) : backend initial complet (schéma,
~35 fonctions, worker, 5 Edge Functions), cadrage (12 livrables), design
UX/UI (37 écrans) — détail dans l'historique de conversation.

## 6. Prochaine étape

Le dashboard admin est terminé côté code. Reste à confirmer que vous
pouvez réellement vous y connecter (§3/§7 — mot de passe à
réinitialiser probablement) pour valider les 24 écrans avec de vraies
actions. En parallèle, prochain chantier naturel : la **demande de
course côté passager** dans `apps/web`, bloquée sur la clé Google Maps
(`pricing_rules` se règle en 30 secondes une fois connecté à
`/tarification`). Sinon, non bloquant : worker de dispatch,
`apps/mobile`, `PAYMENT_WEBHOOK_SECRET`, décisions fournisseurs (§7).

## 7. Décision(s) / action(s) requise(s) de votre part

- **Connexion admin** : essayez `/login` avec `abotchigilles@yahoo.fr`.
  Si ça échoue (probable — voir §3), réinitialisez le mot de passe
  depuis Dashboard → Authentication → Users → ce compte.
- **Clé API Google Maps** (fournisseur décidé le 3 septembre 2026) —
  console.cloud.google.com, activer *Directions API*, *Places API* et
  *Maps JavaScript API* sur un même projet, puis créer deux clés :
  1. Une clé **sans restriction de referrer**, avec seulement
     *Directions API* activée — c'est `GOOGLE_MAPS_API_KEY`, le secret
     Edge Function déjà en attente.
  2. Une clé **restreinte par referrer HTTP** (votre domaine, ou
     `localhost` pour tester) avec *Places API* + *Maps JavaScript API*
     — celle-ci sera visible côté navigateur par construction (comme
     toute clé Maps JS), la restriction de referrer est ce qui la
     protège d'un usage détourné.
- **Mobile Money** : Flooz, TMoney (direct) ou Semoa Togo (agrégateur) —
  non bloquant. Détermine aussi la réponse à la question de custody des
  fonds notée en §3.
- **Comptes développeur mobile** (Expo/EAS, Play Console, Apple
  Developer) — non bloquant avant la Phase 9.
- **Régime fiscal togolais** (facturation pour compte du chauffeur) et
  **statut réglementaire de la collecte Mobile Money pour compte de
  tiers** — à valider avant production réelle (voir
  [01-architecture-fonctionnelle.md](01-architecture-fonctionnelle.md)
  §Rôle des parties et [10-paiements.md](10-paiements.md)).
