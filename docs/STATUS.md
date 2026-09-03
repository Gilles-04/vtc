# État du projet — VTC Togo

*Dernière mise à jour : 3 septembre 2026 (écran admin Paiements construit
et vérifié, migration 9)*

> Instantané, pas un journal — réécrit à chaque mise à jour significative.

## 1. Où en est-on ?

Le backend (schéma, logique métier, module financier complet, deux
catégories voiture/moto-taxi) est **déployé pour de vrai** sur le projet
Supabase dédié : 9 migrations + 5 Edge Functions en place et vérifiées
(32 tables, 49 fonctions, 51 policies RLS, grants internes durcis). Le
**dashboard admin** (`apps/admin/`) a 6 écrans — connexion, vue
d'ensemble, chauffeurs/KYC, courses, **paiements** — vérifiés dans un
vrai navigateur (chauffeurs/courses avec de vraies données, démo insérée
sur le projet réel, id `d0000000-...` ; paiements avec des données
simulées côté réseau, la table est vide sur le projet réel pour l'instant).

**Révision d'architecture (3 septembre 2026)** : le porteur du projet a
demandé une app web en plus des apps mobiles (commander sans smartphone —
cybercafé, ordinateur partagé) et a redéfini la structure en 4
livrables, chacun couvrant passager **et** chauffeur (sauf l'admin) :
Web, Android, iOS, Admin. Android/iOS restent un seul code Expo
(`apps/mobile`) — pas un chantier de plus, deux publications de store.
Détail et justification : `docs/02-architecture-technique.md` §Révision
du 3 septembre 2026.

**`apps/web`** : page d'accueil publique (deux entrées, passager/
chauffeur), même stack et palette que `apps/admin`. **Auth passager
construite** : `/passager` (saisie email → code reçu → compte créé,
`signInWithOtp`/`verifyOtp`, Supabase Auth natif) → `/passager/accueil`
(protégée). `eSMS Africa abandonné` (le porteur du projet change de
société) — code par email au lieu du SMS prévu au cadrage, conçu pour
accueillir les deux moyens plus tard (circuit téléphone en réserve,
non appelé). Détail : `docs/02-architecture-technique.md` §Révision
authentification. `/chauffeur` reste un placeholder.

**Cartographie : Google Maps** (décidé). La demande de course reste
bloquée en pratique, pas sur le choix mais sur la **clé API** elle-même —
aucune fournie à ce jour (voir §7). `pricing-directions` (Edge Function)
attend déjà des coordonnées et appelle Google Directions côté serveur ;
il manque la clé secrète (`GOOGLE_MAPS_API_KEY`) et une clé restreinte
côté client (Maps JavaScript + Places Autocomplete) pour saisir une
adresse.

Un serveur **MCP Supabase** est connecté à cette session (accès direct au
projet réel — lecture, migrations, avis de sécurité) mais c'est un canal
séparé de la politique réseau du sandbox : le navigateur (Playwright,
l'app elle-même) ne peut toujours pas contacter `*.supabase.co`
directement depuis cet environnement — vérification bout-en-bout à faire
en local chez vous ou dans une session avec accès réseau élargi.

Reste à construire : le reste de `apps/web` (auth, demande de course),
`apps/mobile`, ~19 autres écrans admin, le worker de dispatch (écrit, pas
déployé).

## 2. Ce qui fonctionne

**Base de données** (9 migrations, vérifiées en local puis déployées,
comptage confirmé identique) : cycle complet d'une course par catégorie
(matching, cash/Mobile Money), frais de service 2,5 % jamais mélangés à
l'abonnement, facturation/règlement/remboursement automatiques, reporting
financier complet (`admin_stats_overview`), KYC/anti-fraude/support
hérités. Migration 9 : `payments.user_id → profiles.id`, même correctif
d'embedding PostgREST que la migration 7 (drivers/rides).

**5 Edge Functions déployées** (`payment-webhook-momo`,
`phone-verification-start`/`-check`, `pricing-directions`,
`push-notifications-dispatch`) — URLs vérifiées. `push-notifications-dispatch`
tourne réellement de bout en bout via un trigger `pg_net` fait main
(Database Webhook natif cassé sur ce projet, contourné en migration 5).
`phone-verification-start`/`-check` non appelées depuis l'abandon d'eSMS
Africa (voir §1) — conservées, pas supprimées.

**Design** : 37 écrans (canvas Claude Design) — antérieur à la révision
du modèle économique du 3 septembre ET à celle de l'architecture (même
date) ; ne reflète ni les écrans catégorie/facturation/fraude ni le
regroupement passager+chauffeur par plateforme.

## 3. Ce qui pose problème / limites connues

- **`apps/web`, `apps/mobile`, worker de dispatch, reste du dashboard
  admin non construits/déployés.**
- **Secrets Edge Functions pas tous configurés** : `PAYMENT_WEBHOOK_SECRET`
  (aucune dépendance externe) ; `GOOGLE_MAPS_API_KEY` en attente de la
  décision cartographie (§7). `ESMS_AFRICA_API_KEY` n'est plus à l'ordre
  du jour (abandonné, voir §1).
- **Aucun compte staff admin n'existe encore** — le premier `super_admin`
  doit être créé à la main en SQL une fois le compte Auth créé via le
  dashboard (voir `apps/admin/README.md` §Bootstrap) : impossible
  autrement, la policy RLS de `admin_roles` exige déjà d'être
  `super_admin` pour y écrire.
- **Database Webhook natif Supabase cassé sur ce projet** — contourné
  pour `push-notifications-dispatch`, un futur besoin similaire
  rencontrera la même anomalie.
- **Custody des fonds Mobile Money d'une course, non tranchée** (§3
  détaillé : [10-paiements.md](10-paiements.md) §Paiement de la course).
- **`phone-verification-check` non testée, et ne le sera pas dans
  l'immédiat** — eSMS Africa abandonné, circuit en réserve pour un futur
  fournisseur SMS.
- **Rendu PDF de la facture non construit.**
- **Clé API Google Maps manquante** (fournisseur décidé, voir §1/§7) —
  bloque la demande de course côté passager, rien d'autre.
- **Mobile Money** : fournisseur non choisi (§7) — non bloquant, backend
  en mode manuel/admin.
- **Critère de fiabilité du matching non implémenté** (doc 08).
- **Protection mots de passe compromis (HaveIBeenPwned) désactivée** —
  interrupteur dashboard (Authentication → Password protection), pas une
  migration. Deux minutes, quand vous voulez.

Rien en cours — en attente de la prochaine demande.

## 5. Dernièrement terminé

**3 septembre 2026** — détail complet de chaque point dans
`docs/TASKS.md` (TASK-004 à TASK-017, une entrée par point) :
révision du modèle économique (catégories, frais de service) ; module
paiement/abonnement/facturation ; déploiement réel du schéma (9
migrations) et des 5 Edge Functions ; contournement `pg_net` pour les
push ; dashboard admin (login, vue d'ensemble, chauffeurs/KYC, courses,
**paiements**) ; bucket Storage `driver-documents` ; correction d'un bug
d'embedding PostgREST (FK manquantes, drivers/rides **et payments**) ;
MCP Supabase connecté + durcissement de 13 grants internes ; données de
démo + vérification à 5 écrans ; révision d'architecture (4 plateformes) ;
`apps/web` scaffoldé (accueil) ; eSMS Africa abandonné (documentation) ;
auth passager par code email construite et vérifiée.

Antérieurement (2 septembre 2026) : backend initial complet (schéma,
~35 fonctions, worker, 5 Edge Functions), cadrage (12 livrables), design
UX/UI (37 écrans) — détail dans l'historique de conversation.

## 6. Prochaine étape

La demande de course côté passager reste bloquée sur la clé Google Maps
(§7, pas sur le choix du fournisseur — déjà tranché). L'écran admin
Paiements est fait ; reste ~19 écrans admin (voir `docs/05-ecrans.md`
pour la liste). Worker de dispatch, `PAYMENT_WEBHOOK_SECRET` et autres
décisions fournisseurs (§7) non bloquants, en parallèle.

## 7. Décision(s) / action(s) requise(s) de votre part

- **Compte admin** : créez votre compte (Dashboard → Authentication →
  Users → Add user), donnez-moi l'UUID pour le rôle `super_admin`.
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
