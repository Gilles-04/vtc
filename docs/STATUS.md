# État du projet — VTC Togo

*Dernière mise à jour : 3 septembre 2026 (MCP Supabase connecté — accès
réel au projet ; durcissement de sécurité trouvé et corrigé)*

> Instantané, pas un journal — réécrit à chaque mise à jour significative.

## 1. Où en est-on ?

Le backend (schéma, logique métier, module financier complet, deux
catégories voiture/moto-taxi) est **déployé pour de vrai** sur le projet
Supabase dédié : 5 migrations + 5 Edge Functions en place, vérifiées
présentes avec les bonnes URLs. `push-notifications-dispatch` tourne déjà
réellement de bout en bout (contournement `pg_net`, voir §2).

Le **dashboard admin** (`apps/admin/`, React 19 + Vite + TanStack Router) a
5 écrans — connexion staff, vue d'ensemble (`admin_stats_overview`),
chauffeurs/KYC (liste filtrable + détail avec documents et décision
`admin_review_driver_document`/`admin_decide_driver_application`), et
**nouveau** : courses (liste filtrable statut/catégorie/période/zone +
détail avec chronologie complète). Vérifié dans un vrai navigateur
(Playwright) : routage protégé confirmé sur les 6 routes, formulaire de
connexion envoie une vraie requête à l'endpoint Auth du projet réel, tous
les écrans protégés vérifiés sans erreur JS (session simulée côté
navigateur). La confirmation bout-en-bout (connexion réussie + données
réelles) n'a pas pu être testée depuis cet environnement (réseau vers
`*.supabase.co` bloqué côté sandbox) — à faire en lançant l'app en local
sur votre machine.

Le bucket Storage privé `driver-documents` (migration 6) et les FK
`profiles` sur `drivers`/`rides.passenger_id` (migration 7, corrige un bug
d'embedding PostgREST trouvé et jamais détecté auparavant) sont tous deux
déployés sur le projet réel.

**Nouveau** : un serveur MCP Supabase est maintenant connecté à cette
session, avec accès réel et direct au projet (lecture de données,
application de migrations, avis de sécurité/performance). Ça change le
mode opératoire pour la suite : plus besoin de découper les migrations en
morceaux à coller à la main dans le SQL Editor — j'applique directement et
je vérifie avec de vraies requêtes contre le projet réel. Première
utilisation concluante : `get_advisors` a révélé que 13 fonctions internes
(déclenchées uniquement par trigger, `pg_cron`, ou le worker de dispatch)
étaient techniquement appelables en RPC direct par n'importe quel compte
authentifié — jamais détecté avant (aucune de ces fonctions ne fait de
dégât si un utilisateur authentifié les appelle directement — la plupart
sont des fonctions trigger que Postgres bloque nativement hors contexte de
trigger — mais `cleanup_rate_limits`/`expire_subscriptions`/
`dispatch_next_offer`/`expire_ride_offers_and_dispatch` auraient permis de
contourner le rate-limiting ou d'interférer avec le dispatch). Corrigé et
vérifié (migration 8, voir `docs/TASKS.md` TASK-011).

**Données de démo insérées** sur le projet réel (3 chauffeurs — voiture
approuvé, moto approuvé, voiture en attente KYC avec 2 documents — 1
abonnement actif, 2 courses) pour pouvoir visualiser le dashboard rempli.
Tous les id commencent par `d0000000-...`, faciles à identifier/supprimer
(requête de nettoyage en commentaire dans l'historique de conversation —
demandez si besoin de la retrouver). Les 5 écrans (vue d'ensemble,
chauffeurs liste + détail/KYC, courses liste + détail) ont été vérifiés
avec ces vraies données via interception réseau côté navigateur (le
navigateur ne peut toujours pas contacter Supabase directement depuis ce
sandbox) — un bug d'interception dans mon propre script de test a été
trouvé et corrigé au passage (pas un bug de l'application).

Reste à construire : les ~20 autres écrans admin, les 2 apps mobiles
(passager/chauffeur), le worker de dispatch (écrit, pas déployé).

## 2. Ce qui fonctionne

**Base de données** (8 migrations), vérifiée de bout en bout contre
Postgres 16 + PostGIS local, **et déployée** sur le projet réel (32
tables, 49 fonctions, 51 policies RLS, 6 plans, bucket Storage
`driver-documents` avec ses 4 policies, FK `profiles` sur
`drivers`/`rides.passenger_id`, grants internes durcis — comptage confirmé
identique) :
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
- **Protection mots de passe compromis (HaveIBeenPwned) désactivée** —
  trouvé via `get_advisors` (MCP Supabase). Pas une migration : un
  interrupteur dans le dashboard, **Authentication → Policies/Auth
  settings → Password protection**. Deux minutes, quand vous voulez.

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
   courses) et corrigé (migration 7, FK manquantes) — vérifié en local
   puis déployé sur le projet réel.
8. Écran courses (`apps/admin/`) : liste filtrable + détail avec
   chronologie, vérifiés dans un vrai navigateur.
9. MCP Supabase connecté (accès direct au projet réel) ; `get_advisors` a
   trouvé 13 fonctions internes exposées en RPC direct à tout compte
   authentifié — corrigé (migration 8), vérifié en local puis sur le
   projet réel (avant/après avec de vraies requêtes de privilèges).
10. Données de démo insérées sur le projet réel ; les 5 écrans du
    dashboard admin vérifiés avec ces vraies données (captures d'écran).

Antérieurement (2 septembre 2026) : backend initial complet (schéma,
~35 fonctions, worker, 5 Edge Functions), cadrage (12 livrables), design
UX/UI (37 écrans) — détail dans l'historique de conversation.

## 6. Prochaine étape

Précision utile sur le MCP Supabase : c'est un canal séparé (connecteur
avec votre autorisation), pas un changement de la politique réseau de
cette session — confirmé en retestant (bloqué comme avant, `CONNECT
tunnel failed, 403`). Donc je peux désormais interroger/modifier la base
directement, mais tester le dashboard admin lui-même dans un vrai
navigateur nécessite toujours l'une des deux options données précédemment
(nouvelle session avec accès réseau élargi, ou lancer l'app en local chez
vous).

Sans priorité indiquée, je poursuis le dashboard admin — écran suivant à
déterminer (paiements ou abonnements, dépendances externes nulles,
exposent le module financier déjà construit et testé). En parallèle, reste
ouvert quand vous voulez :
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
