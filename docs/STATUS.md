# État du projet — VTC Togo

*Dernière mise à jour : 3 septembre 2026 (bug d'embedding PostgREST
profiles trouvé et corrigé, migration 7 en attente de collage)*

> Instantané, pas un journal — réécrit à chaque mise à jour significative.

## 1. Où en est-on ?

Le backend (schéma, logique métier, module financier complet, deux
catégories voiture/moto-taxi) est **déployé pour de vrai** sur le projet
Supabase dédié : 5 migrations + 5 Edge Functions en place, vérifiées
présentes avec les bonnes URLs. `push-notifications-dispatch` tourne déjà
réellement de bout en bout (contournement `pg_net`, voir §2).

Le **dashboard admin** (`apps/admin/`, React 19 + Vite + TanStack Router) a
3 écrans — connexion staff, vue d'ensemble (`admin_stats_overview`), et
chauffeurs/KYC (liste filtrable + détail avec documents et décision
`admin_review_driver_document`/`admin_decide_driver_application`). Vérifié
dans un vrai navigateur (Playwright) : routage protégé confirmé sur les 4
routes, formulaire de connexion envoie une vraie requête à l'endpoint Auth
du projet réel, écrans chauffeurs vérifiés sans erreur JS (session simulée
côté navigateur). La confirmation bout-en-bout (connexion réussie +
données réelles) n'a pas pu être testée depuis cet environnement (réseau
vers `*.supabase.co` bloqué côté sandbox) — à faire en lançant l'app en
local sur votre machine.

**Nouveau** : le bucket Storage privé `driver-documents` (migration 6) est
déployé sur le projet réel — le lien « Voir » d'un document, jusque-là
inerte, fonctionne désormais.

**Bug trouvé en préparant l'écran suivant** : `drivers.id` et
`rides.passenger_id` référencent `auth.users` directement, jamais
`profiles` — sans FK entre les deux tables, PostgREST ne peut pas
embarquer `profiles(...)` (`Could not find a relationship...`). Ça aurait
cassé l'affichage du nom/téléphone dans l'écran chauffeurs déjà livré
(jamais détecté, jamais exercé contre le projet réel). Corrigé par la
migration 7 (`00000000000007_profile_embed_fks.sql`, ajoute les FK
manquantes, aucun changement de code requis) — **vérifiée en local,
reste à coller** (voir §6).

Reste à construire : les ~22 autres écrans admin, les 2 apps mobiles
(passager/chauffeur), le worker de dispatch (écrit, pas déployé).

## 2. Ce qui fonctionne

**Base de données** (7 migrations, la 7ᵉ écrite et vérifiée en local, pas
encore collée sur le projet réel), vérifiée de bout en bout contre
Postgres 16 + PostGIS local (32 tables, 49 fonctions, 51 policies RLS, 6
plans, bucket Storage `driver-documents` avec ses 4 policies pour les 6
premières migrations — comptage confirmé identique sur le projet réel) :
- Cycle complet d'une course par catégorie (voiture/moto), matching filtré
  par catégorie, cash ou Mobile Money.
- Frais de service (2,5 %) calculés une fois à la confirmation du
  paiement, jamais recalculés ; paiement course Mobile Money via
  `confirm_ride_payment` (webhook, vérifie montant/`ride_id`, anti-doublon
  `transaction_id` au niveau base — contrainte, pas seulement applicatif).
- Facturation automatique (trigger, `completed` + `payment_status='success'`
  uniquement), règlement par lot, remboursement (`admin_refund_payment`,
  idempotent, exclut la course des agrégats "succès" du reporting).
- Reporting financier complet (`admin_stats_overview`) : abonnement et
  frais de service toujours séparés, par catégorie ; volume, cash/Mobile
  Money, échecs, remboursements, net chauffeur.
- KYC, anti-fraude, suspension de compte, support : hérités, non retouchés
  récemment.

**Les 5 Edge Functions sont déployées** (`payment-webhook-momo`,
`phone-verification-start`, `phone-verification-check`,
`pricing-directions`, `push-notifications-dispatch`) — URLs vérifiées une
par une. Deux incidents réels rencontrés et corrigés en route : 4
fonctions d'abord créées sans leurs tirets (le nom affiché est éditable
après coup, pas l'URL réelle — il a fallu supprimer/recréer), et
`pricing-directions` qui ne transmettait pas `category` à
`estimate_ride_fare` (corrigé avant déploiement).

**`push-notifications-dispatch` fonctionne réellement** — pas via un
Database Webhook natif (anomalie du projet : `ERROR: 3F000: schema
"supabase_functions" does not exist`, ce schéma normalement provisionné
par défaut est absent sur ce projet, `pg_net` lui-même bien présent) mais
via un trigger Postgres fait main (migration
`00000000000005_notifications_push_trigger.sql`, `pg_net.http_post`
direct, même format de payload). Vérifié réellement : notification de
test → appel HTTP confirmé dans `net._http_response` (200, réponse
attendue).

**Design** : 37 écrans (canvas Claude Design) — antérieur à la révision du
modèle économique du 3 septembre, ne reflète pas les écrans catégorie/
facturation/règlement/fraude documentés en [05-ecrans.md](05-ecrans.md)
(~58 écrans désormais).

## 3. Ce qui pose problème / limites connues

- **Worker de dispatch, apps mobiles, reste du dashboard admin non
  construits/déployés** — Auth, Realtime, `pg_cron` pas encore exercés en
  conditions réelles par une vraie app (Storage l'est désormais, voir §2).
- **Secrets Edge Functions pas tous configurés** : `PAYMENT_WEBHOOK_SECRET`
  (aucune dépendance externe, à faire quand vous voulez) ;
  `ESMS_AFRICA_API_KEY`/`GOOGLE_MAPS_API_KEY` en attente des décisions
  fournisseurs (§7).
- **Aucun compte staff admin n'existe encore** — le premier `super_admin`
  doit être créé à la main en SQL (`insert into admin_roles...`, voir
  `apps/admin/README.md` §Bootstrap) : la policy RLS de `admin_roles`
  exige déjà d'être `super_admin` pour y écrire, par construction —
  impossible de créer le tout premier autrement que par SQL direct.
- **Database Webhook natif Supabase cassé sur ce projet** — contourné pour
  `push-notifications-dispatch` (voir §2), mais un futur besoin similaire
  rencontrera la même anomalie.
- **Custody des fonds Mobile Money d'une course, non tranchée** :
  mécanisme construit et testé, mais dépend du fournisseur retenu si les
  fonds transitent par un compte plateforme ou non — question
  réglementaire à trancher avec vous (voir
  [10-paiements.md](10-paiements.md) §Paiement de la course).
- **`phone-verification-check` jamais testée en conditions réelles** — le
  point le plus incertain du backend, nécessite un compte eSMS Africa.
- **Canvas de design non mis à jour** pour la révision du 3 septembre.
- **Rendu PDF de la facture non construit** (seule la ligne `invoices`
  existe).
- **Décisions fournisseurs non prises** : Google Maps vs Mapbox, Mobile
  Money (§7) — non bloquant, backend en mode manuel/admin.
- **Critère de fiabilité du matching non implémenté** (doc 08).

Rien en cours — en attente de la prochaine demande.

## 5. Dernièrement terminé

**3 septembre 2026**, dans l'ordre :
1. Révision du modèle économique (deux catégories, abonnement + 2,5 %
   frais de service, facturation, règlement) — schéma, logique métier,
   docs 01/03-12.
2. Module paiement/abonnement/facturation complet (Mobile Money course
   via webhook vérifié, remboursements, reporting financier détaillé).
3. Déploiement réel du schéma (5 migrations, 37 morceaux collés dans le
   SQL Editor) et des 5 Edge Functions — comptages et URLs vérifiés,
   incidents réels corrigés en route (voir §2).
4. Contournement `pg_net` pour `push-notifications-dispatch`, vérifié
   réellement contre le projet déployé.
5. Dashboard admin (`apps/admin/`) : login, vue d'ensemble, et écran
   chauffeurs/KYC (liste + détail + décision), vérifiés dans un vrai
   navigateur.
6. Bucket Storage `driver-documents` + policies RLS (migration 6),
   vérifié en local puis déployé sur le projet réel.
7. Bug d'embedding PostgREST `profiles` trouvé (en préparant l'écran
   courses) et corrigé (migration 7, FK manquantes) — vérifié en local,
   pas encore collé sur le projet réel.

Antérieurement (2 septembre 2026) : backend initial complet (schéma,
~35 fonctions, worker, 5 Edge Functions), cadrage (12 livrables), design
UX/UI (37 écrans) — détail dans l'historique de conversation.

## 6. Prochaine étape

- **Coller la migration 7** (FK `profiles`, < 1 Ko, un seul morceau,
  aucune dépendance externe) — bloquant pour tout futur écran qui affiche
  un nom/téléphone de passager ou chauffeur.

Ensuite, sans priorité indiquée, je poursuis le dashboard admin — écran
« Liste courses » plutôt que « Carte live » (celle-ci dépend de la
décision cartographie non encore prise, §7). En parallèle, reste ouvert
quand vous voulez :
- **Vérification backend** : créer le secret `PAYMENT_WEBHOOK_SECRET`
  (aucune dépendance externe), puis tester réellement
  `phone-verification-check` (nécessite un compte eSMS Africa, §7).

Le worker de dispatch (VPS + systemd) et les décisions fournisseurs (§7)
restent en parallèle, non bloquants.

## 7. Décision(s) / action(s) requise(s) de votre part

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
