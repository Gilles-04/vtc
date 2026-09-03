# État du projet — VTC Togo

*Dernière mise à jour : 3 septembre 2026 (`apps/web` scaffoldé — page
d'accueil publique passager/chauffeur, vérifiée dans un vrai navigateur)*

> Instantané, pas un journal — réécrit à chaque mise à jour significative.

## 1. Où en est-on ?

Le backend (schéma, logique métier, module financier complet, deux
catégories voiture/moto-taxi) est **déployé pour de vrai** sur le projet
Supabase dédié : 8 migrations + 5 Edge Functions en place et vérifiées
(32 tables, 49 fonctions, 51 policies RLS, grants internes durcis). Le
**dashboard admin** (`apps/admin/`) a 5 écrans — connexion, vue
d'ensemble, chauffeurs/KYC, courses — vérifiés dans un vrai navigateur
avec de vraies données (démo insérée sur le projet réel pour la
démonstration, id `d0000000-...`).

**Révision d'architecture (3 septembre 2026)** : le porteur du projet a
demandé une app web en plus des apps mobiles (commander sans smartphone —
cybercafé, ordinateur partagé) et a redéfini la structure en 4
livrables, chacun couvrant passager **et** chauffeur (sauf l'admin) :
Web, Android, iOS, Admin. Android/iOS restent un seul code Expo
(`apps/mobile`) — pas un chantier de plus, deux publications de store.
Détail et justification : `docs/02-architecture-technique.md` §Révision
du 3 septembre 2026.

**`apps/web` — premier tronçon construit** : page d'accueil publique
(deux entrées, passager/chauffeur), même stack et même palette que
`apps/admin`. Vérifié dans un vrai navigateur (Playwright) : rendu
desktop et mobile, navigation, aucune erreur JS. Les pages `/passager` et
`/chauffeur` sont des placeholders honnêtes (« bientôt disponible ») —
l'auth passager et la demande de course dépendent de décisions pas
encore prises (méthode OTP, compte eSMS Africa, cartographie).

Un serveur **MCP Supabase** est connecté à cette session (accès direct au
projet réel — lecture, migrations, avis de sécurité) mais c'est un canal
séparé de la politique réseau du sandbox : le navigateur (Playwright,
l'app elle-même) ne peut toujours pas contacter `*.supabase.co`
directement depuis cet environnement — vérification bout-en-bout à faire
en local chez vous ou dans une session avec accès réseau élargi.

Reste à construire : le reste de `apps/web` (auth, demande de course),
`apps/mobile`, ~20 autres écrans admin, le worker de dispatch (écrit, pas
déployé).

## 2. Ce qui fonctionne

**Base de données** (8 migrations, vérifiées en local puis déployées,
comptage confirmé identique) : cycle complet d'une course par catégorie
(matching, cash/Mobile Money), frais de service 2,5 % jamais mélangés à
l'abonnement, facturation/règlement/remboursement automatiques, reporting
financier complet (`admin_stats_overview`), KYC/anti-fraude/support
hérités.

**5 Edge Functions déployées** (`payment-webhook-momo`,
`phone-verification-start`/`-check`, `pricing-directions`,
`push-notifications-dispatch`) — URLs vérifiées. `push-notifications-dispatch`
tourne réellement de bout en bout via un trigger `pg_net` fait main
(Database Webhook natif cassé sur ce projet, contourné en migration 5).

**Design** : 37 écrans (canvas Claude Design) — antérieur à la révision
du modèle économique du 3 septembre ET à celle de l'architecture (même
date) ; ne reflète ni les écrans catégorie/facturation/fraude ni le
regroupement passager+chauffeur par plateforme.

## 3. Ce qui pose problème / limites connues

- **`apps/web`, `apps/mobile`, worker de dispatch, reste du dashboard
  admin non construits/déployés.**
- **Secrets Edge Functions pas tous configurés** : `PAYMENT_WEBHOOK_SECRET`
  (aucune dépendance externe) ; `ESMS_AFRICA_API_KEY`/`GOOGLE_MAPS_API_KEY`
  en attente des décisions fournisseurs (§7).
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
- **`phone-verification-check` jamais testée en conditions réelles** —
  nécessite un compte eSMS Africa.
- **Rendu PDF de la facture non construit.**
- **Décisions fournisseurs non prises** : Google Maps vs Mapbox, Mobile
  Money (§7) — non bloquant, backend en mode manuel/admin.
- **Critère de fiabilité du matching non implémenté** (doc 08).
- **Protection mots de passe compromis (HaveIBeenPwned) désactivée** —
  interrupteur dashboard (Authentication → Password protection), pas une
  migration. Deux minutes, quand vous voulez.

Rien en cours — en attente de la prochaine demande.

## 5. Dernièrement terminé

**3 septembre 2026** — détail complet de chaque point dans
`docs/TASKS.md` (TASK-004 à TASK-011, une entrée par point) :
révision du modèle économique (catégories, frais de service) ; module
paiement/abonnement/facturation ; déploiement réel du schéma (8
migrations) et des 5 Edge Functions ; contournement `pg_net` pour les
push ; dashboard admin (login, vue d'ensemble, chauffeurs/KYC, courses) ;
bucket Storage `driver-documents` ; correction d'un bug d'embedding
PostgREST (FK manquantes) ; MCP Supabase connecté + durcissement de 13
grants internes ; données de démo + vérification à 5 écrans ; révision
d'architecture (4 plateformes) ; `apps/web` scaffoldé (page d'accueil
publique passager/chauffeur, vérifiée).

Antérieurement (2 septembre 2026) : backend initial complet (schéma,
~35 fonctions, worker, 5 Edge Functions), cadrage (12 livrables), design
UX/UI (37 écrans) — détail dans l'historique de conversation.

## 6. Prochaine étape

Pour avancer sur `apps/web` au-delà de la page d'accueil, une décision
est nécessaire : **méthode d'authentification passager** — OTP téléphone
(prévu au cadrage, nécessite le compte eSMS Africa pas encore créé) ou
email/mot de passe en intérimaire (comme l'admin, testable dès
maintenant, à remplacer plus tard). Sans réponse, je pars sur
email/mot de passe par défaut pour ne pas bloquer.

Sinon, sans priorité indiquée : reprendre le dashboard admin
(paiements/abonnements). En parallèle, reste ouvert quand vous voulez :
créer le secret `PAYMENT_WEBHOOK_SECRET`, tester `phone-verification-check`
(compte eSMS Africa requis). Worker de dispatch et décisions fournisseurs
(§7) non bloquants.

## 7. Décision(s) / action(s) requise(s) de votre part

- **Compte admin** : créez votre compte (Dashboard → Authentication →
  Users → Add user), donnez-moi l'UUID pour le rôle `super_admin`.
- **Compte eSMS Africa** : à créer (distinct de votre autre projet) —
  nécessaire pour tester `phone-verification-start`/`-check` réellement.
- **Cartographie** : Google Maps Platform (recommandé) ou Mapbox.
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
