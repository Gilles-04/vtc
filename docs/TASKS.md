# Suivi des tâches — VTC Togo

Tâches en cours ou récemment terminées. Idées non démarrées : voir
[`12-roadmap.md`](12-roadmap.md) (structuré en phases plutôt qu'en backlog
libre).

---

## TASK-001 — Cadrage initial + schéma de base de données

- **Objectif** : produire les 12 livrables demandés avant tout
  développement (architecture, sitemap, parcours, écrans, schéma BD, API,
  logique matching/abonnement/paiement, sécurité, roadmap), puis un schéma
  SQL initial vérifié.
- **Statut** : Terminé (2 septembre 2026).
- **Fait** : les 12 documents dans `docs/` ; migration
  `supabase/migrations/00000000000001_schema_initial.sql` ; structure de
  monorepo (`apps/`, `packages/`, `supabase/`) avec README explicatifs par
  dossier (pas de code applicatif — aucun compte fournisseur ouvert à ce
  stade).
- **Vérifié** : migration appliquée à un Postgres 16 + PostGIS local
  (installé pour l'occasion) — RLS, trigger de création de compte,
  contrainte d'unicité d'abonnement actif et protection des colonnes
  sensibles testées avec de vraies requêtes, pas seulement une relecture.
- **Résultat** : voir `docs/STATUS.md` §7 pour les décisions fournisseurs
  requises avant la Phase 0 de la roadmap.

---

## TASK-002 — Design UX/UI complet (passager, chauffeur, design system)

- **Objectif** : maquettes des 19 écrans passager + 18 écrans chauffeur +
  design system, style moderne/premium adapté au marché togolais.
- **Statut** : Terminé (2 septembre 2026).
- **Fait** : 39 planches publiées en canvas Claude Design (lien dans
  l'historique de conversation — non reproduit ici, ce fichier ne stocke
  pas de liens externes volatils). Palette émeraude/or/encre chaude,
  Manrope + Work Sans, bouton disponible/indisponible réellement
  interactif sur le tableau de bord chauffeur.
- **Vérifié** : relecture par un second passage (agent dédié) sur
  cohérence des tokens, conformité au format, contenu vs. cadrage ;
  3 corrections mineures appliquées (cible tactile trop petite, libellés
  de navigation harmonisés, un token couleur manquant).
- **Résultat** : aucun code applicatif produit (maquettes uniquement) —
  sert de référence visuelle pour la Phase 4+ de la roadmap.

---

## TASK-003 — Backend complet (schéma, logique métier, worker, Edge Functions)

- **Objectif** : architecture backend réellement exploitable — schéma de
  données étendu, moteur de matching/abonnement/paiement/support en SQL,
  système anti-fraude, worker de dispatch, Edge Functions.
- **Statut** : Terminé (2 septembre 2026).
- **Fait** :
  - Schéma étendu de 20 à 29 tables (voir `docs/STATUS.md` pour le détail
    des ajouts) dans 4 migrations SQL (`supabase/migrations/`).
  - ~35 fonctions RPC `SECURITY DEFINER` + 5 triggers automatiques
    couvrant l'intégralité de `docs/07-api.md`.
  - `services/matching-worker/` : processus Node.js/TypeScript compilé.
  - `supabase/functions/` : 5 Edge Functions Deno (paiement, vérification
    téléphone ×2, tarification, notifications push).
  - Mise à jour complète des docs 06/07/08/09/10/11 et du README racine
    pour refléter ce qui est réellement construit, pas une intention.
- **Vérifié** — intégralement en local, rien contre un vrai projet
  Supabase (aucun projet réel disponible) :
  - Les 4 migrations s'appliquent proprement en séquence contre un
    Postgres 16 + PostGIS installé pour l'occasion.
  - 25 assertions automatisées couvrant le cycle de vie complet d'une
    course, d'un abonnement (avec code promo), du KYC, du support, de la
    suspension de compte, et des trois mécanismes anti-fraude — toutes
    passantes, y compris les rejets attendus (limite de débit, compte
    suspendu, fonction interne inaccessible).
  - Deux bugs SQL réels trouvés et corrigés en testant : un `record`
    PL/pgSQL déréférencé sans être assigné, une expression `CASE`
    littérale mal typée sur trois colonnes enum.
  - `services/matching-worker/` : compilé (`tsc --noEmit`), puis exécuté
    pour de vrai contre un Postgres local (offre expirée artificiellement
    → balayée et relancée).
  - Les 5 Edge Functions : `deno check` (contre les vrais types
    `@supabase/supabase-js`, résolus via npm) et `deno lint`, sans erreur.
- **Résultat** : voir `docs/STATUS.md` §3 pour les limites connues
  (notamment `phone-verification-check`, jamais testée en conditions
  réelles) et §7 pour les décisions fournisseurs requises avant la
  Phase 0 de la roadmap.

---

## TASK-004 — Révision du modèle économique (catégories, facturation, règlement)

- **Objectif** : appliquer la révision du cahier des charges du
  3 septembre 2026 — deux catégories de conducteurs (voiture/moto-taxi),
  deux revenus distincts (abonnement 1 000/500 FCFA + frais de service
  2,5 %/course, jamais mélangés), facturation automatique, règlement
  différé par lot — de façon cohérente dans le schéma, la logique métier et
  les 12 livrables.
- **Statut** : Terminé (3 septembre 2026).
- **Fait** :
  - `docs/01-architecture-fonctionnelle.md` réécrit (nouveau modèle
    économique, rôle des parties).
  - Migration 1 : enums `driver_category`/`settlement_status`, statuts
    alignés (`driver_arrived`, `cancelled_by_system`), colonne `category`
    sur 4 tables, nouvelles tables `settlements`/`invoices` + RLS,
    suppression du chemin d'insertion directe mort sur `drivers`, seed à
    6 plans par catégorie.
  - Migration 2 : catégorie propagée dans `submit_driver_application`/
    `estimate_ride_fare`/`create_ride_request`/`dispatch_next_offer` ;
    `complete_ride` calcule les frais de service ; trigger
    `generate_invoice_on_ride_success` ; nouvelles fonctions
    `admin_create_settlement`/`admin_mark_settlement_paid` ; garde-fou
    catégorie sur `purchase_subscription` ; `admin_stats_overview` sépare
    les deux revenus.
  - Docs 03/04/05/06/07/08/09/10/11 + README + roadmap mis à jour pour
    rester cohérents (un vrai bug documentaire trouvé et corrigé au
    passage : la roadmap listait le moto-taxi comme extension post-MVP
    alors qu'il est désormais dans le MVP).
- **Vérifié** : migrations 1+2 réappliquées contre un Postgres 16 + PostGIS
  local, scénario complet rejoué (voiture + moto, abonnements croisés
  refusés, matching filtré par catégorie, frais de service calculés,
  facture générée automatiquement, règlement créé/soldé, double règlement
  rejeté, séparation des deux revenus dans les statistiques admin) — pas
  seulement relu.
- **Résultat** : voir `docs/STATUS.md` §3 pour les limites connues
  (notamment le canvas de design non mis à jour pour cette révision) et §7
  pour les décisions fournisseurs requises avant la Phase 0 de la roadmap.

---

## TASK-005 — Module paiement, abonnement et facturation (complet)

- **Objectif** : construire le module financier complet demandé —
  paiement de course en Mobile Money via un vrai cycle webhook (créer
  transaction → transmettre → attendre → vérifier signature/montant/
  ride_id/transaction_id → empêcher les doublons → confirmer → facturer),
  remboursements, reporting financier détaillé (10 items), sans jamais
  fusionner abonnement et frais de plateforme.
- **Statut** : Terminé (3 septembre 2026).
- **Fait** :
  - Migration 1 : `payments.ride_id` (relie un paiement de course à sa
    course), contrainte unique `(provider, provider_ref)` anti-doublon de
    `transaction_id`, RLS `payments` étendue au chauffeur concerné.
  - Migration 2 : `complete_ride` distingue cash (confirmation immédiate)
    et Mobile Money (crée un paiement `pending`, course en `processing`) ;
    nouvelle fonction `confirm_ride_payment` (vérifie montant et `ride_id`,
    idempotente, réservée `service_role`) ; `admin_mark_payment_failed`
    synchronise `rides.payment_status` ; nouvelle fonction
    `admin_refund_payment` ; `admin_stats_overview` étendu aux 10 items de
    reporting demandés (volume courses, cash/Mobile Money, échecs,
    remboursements, montant chauffeurs).
  - Edge Function `payment-webhook-momo` routée selon `payments.purpose`
    (`confirm_ride_payment` vs `confirm_subscription_payment`), échec
    fournisseur synchronisé sur la course.
  - Docs 06/07/09/10/11 mis à jour (nouveau flux de paiement course,
    nouvelles fonctions, reporting).
- **Vérifié** : migrations réappliquées contre un Postgres 16 + PostGIS
  local ; scénario complet rejoué (course Mobile Money → paiement pending
  → montant erroné rejeté → ride_id erroné rejeté → confirmation valide →
  frais de service calculés → facture générée → réutilisation du
  `transaction_id` rejetée par la contrainte base → remboursement →
  agrégats de reporting corrects avant/après) ; `deno check`/`deno lint`
  propres sur l'Edge Function modifiée.
- **Résultat** : voir `docs/STATUS.md` §3 pour la limite ouverte la plus
  significative (custody des fonds Mobile Money d'une course, dépend du
  fournisseur retenu, à trancher avec le porteur du projet).

---

## TASK-006 — Déploiement réel (schéma, Edge Functions) + premier écran admin

- **Objectif** : sortir du "tout en local" — déployer le backend sur le
  vrai projet Supabase dédié, puis construire et vérifier un premier
  tronçon d'application réelle (le porteur du projet a demandé à voir un
  visuel de l'application, pas seulement des maquettes).
- **Statut** : Terminé (3 septembre 2026) pour la partie déploiement +
  premier écran ; le reste du dashboard et les apps mobiles restent à
  construire (voir `docs/STATUS.md` §6).
- **Fait** :
  - 5 migrations SQL appliquées sur le projet Supabase réel (37 morceaux
    découpés automatiquement pour la limite de collage du SQL Editor,
    frontières de fonctions/commentaires respectées).
  - 5 Edge Functions déployées via le dashboard.
  - Migration 5 (`00000000000005_notifications_push_trigger.sql`) : trigger
    `pg_net` fait main contournant l'échec du Database Webhook natif
    (`supabase_functions` absent sur ce projet).
  - `apps/admin/` scaffoldé (React 19 + Vite + TanStack Router + Tailwind
    v4 + Supabase JS) : page de connexion staff, vue d'ensemble
    (`admin_stats_overview`), garde de route.
- **Vérifié** :
  - Comptage post-déploiement identique à l'application locale (32
    tables, 49 fonctions, 51 policies RLS, 6 plans).
  - `push-notifications-dispatch` : notification de test → appel HTTP réel
    confirmé dans `net._http_response`.
  - Dashboard admin : `tsc -b`, `vite build`, `oxlint` propres ; rendu
    réel vérifié avec Playwright/Chromium (capture d'écran) — routage
    protégé confirmé (redirection vers `/login`), formulaire de connexion
    envoie une vraie requête à l'endpoint Auth du projet réel. La
    confirmation bout-en-bout (connexion + données réelles) n'a pas pu
    être testée depuis cet environnement (réseau vers `*.supabase.co`
    bloqué côté sandbox).
  - Deux incidents réels rencontrés et corrigés en route pendant le
    déploiement : 4 Edge Functions créées sans leurs tirets dans l'URL
    (recréées), `pricing-directions` ne transmettait pas `category` à
    `estimate_ride_fare` (corrigé avant déploiement).
- **Résultat** : voir `docs/STATUS.md` §1-3 pour l'état détaillé et les
  limites (notamment : aucun compte staff admin n'existe encore, à créer
  à la main en SQL — voir `apps/admin/README.md` §Bootstrap).

---

## TASK-007 — Écran admin chauffeurs/KYC (liste + détail + décision)

- **Objectif** : deuxième tronçon du dashboard admin — permettre de
  valider un dossier chauffeur (documents + décision globale) sans passer
  par SQL direct.
- **Statut** : Terminé (3 septembre 2026).
- **Fait** :
  - `/chauffeurs` : liste filtrable par statut (par défaut « en attente de
    revue »), catégorie, note, nombre de courses.
  - `/chauffeurs/$driverId` : profil, véhicule, documents KYC (URL signée
    Storage), décision par document (`admin_review_driver_document`,
    motif de rejet demandé) et décision globale du dossier
    (`admin_decide_driver_application`, confirmation demandée).
  - Navigation ajoutée dans `Shell.tsx` (lien « Chauffeurs »).
  - `src/lib/types.ts` étendu (`DriverListRow`, `DriverDetail`, `Vehicle`,
    `DriverDocument`, etc.), nouveaux composants `Badge`/`DriverStatusBadge`/
    `CategoryBadge`.
- **Vérifié** : `tsc -b`, `vite build`, `oxlint` propres (2 avertissements
  non bloquants, pattern déjà présent dans le code précédent — reset d'état
  au changement de filtre). Playwright/Chromium réel : les deux nouvelles
  routes protégées redirigent vers `/login` sans session ; avec une session
  simulée côté navigateur, les deux écrans se montent sans erreur JS et
  affichent l'état d'erreur réseau attendu (capture d'écran à l'appui). La
  confirmation bout-en-bout (données réelles, décision KYC effective) n'a
  pas pu être testée depuis cet environnement (réseau vers `*.supabase.co`
  bloqué côté sandbox).
- **Résultat** : le bucket Storage privé `driver-documents` n'a jamais été
  créé (ni migration, ni trace dashboard) — le lien « Voir » du document
  restera absent tant qu'il n'existe pas (échec silencieux de
  `createSignedUrl`, pas de crash). Voir `docs/STATUS.md` §3.

---

## TASK-008 — Bucket Storage `driver-documents` + policies RLS

- **Objectif** : combler le manque identifié par TASK-007 — créer le
  bucket privé + policies permettant à l'écran chauffeurs/KYC d'afficher
  réellement les documents (lien « Voir », URL signée).
- **Statut** : Terminé (3 septembre 2026) — écrit, vérifié localement, puis
  collé et exécuté avec succès sur le projet réel.
- **Fait** :
  - `supabase/migrations/00000000000006_driver_documents_storage.sql` :
    `insert into storage.buckets` + 4 policies RLS sur `storage.objects`
    (select/insert/update/delete). Convention de chemin imposée par les
    policies : `<driver_id>/<fichier>`, premier segment = UUID auth du
    chauffeur.
  - `docs/11-securite.md` §Documents KYC mis à jour (convention de chemin,
    portée exacte des policies).
- **Vérifié** — contre un Postgres 16 + PostGIS local (schémas `auth`,
  `net`, `storage` reconstruits à la main, absents d'un Postgres nu) :
  - Les 6 migrations s'appliquent proprement en séquence.
  - Chauffeur A peut uploader/lire/modifier dans son propre dossier ;
    upload dans le dossier du chauffeur B rejeté par RLS ; modification
    d'un fichier du chauffeur B : 0 ligne affectée.
  - Chauffeur A en `SELECT` ne voit que son propre fichier.
  - Un compte `super_admin` voit les fichiers des deux chauffeurs (accès
    admin fonctionnel), mais ne peut pas uploader dans un dossier qui
    n'est pas le sien (portée volontairement restreinte, pas de besoin
    identifié pour un upload admin).
- **Résultat** : bucket + policies en place sur le projet réel. Le lien
  « Voir » de l'écran chauffeurs/KYC (`apps/admin/`) est désormais
  fonctionnel (non re-testé bout-en-bout depuis cet environnement, réseau
  vers `*.supabase.co` bloqué côté sandbox — voir `docs/STATUS.md`).

---

## TASK-009 — Corrige l'embedding PostgREST profiles cassé (drivers/rides)

- **Objectif** : en préparant l'écran « Liste courses », repéré que
  `drivers.id` et `rides.passenger_id` référencent `auth.users`
  directement, jamais `public.profiles` (contrairement à `passengers.id`,
  qui référence bien `profiles`) — PostgREST ne peut embarquer une
  relation sans contrainte FK explicite entre les deux tables demandées.
  `Drivers.tsx`/`DriverDetail.tsx` (TASK-007, déjà commités) utilisent
  `.select('..., profiles(phone, full_name)')` depuis `drivers` : ça
  aurait échoué à l'exécution contre de vraies données avec « Could not
  find a relationship... » — jamais détecté car jamais exercé contre le
  projet réel (réseau sandbox bloqué).
- **Statut** : Terminé (3 septembre 2026).
- **Fait** : migration 7
  (`00000000000007_profile_embed_fks.sql`) — ajoute
  `drivers.id → profiles.id` et `rides.passenger_id → profiles.id` (FK
  additionnelles, aucune retirée). Aucun changement de code nécessaire
  côté `apps/admin/` : `profiles(...)` résout désormais sans ambiguïté.
- **Vérifié** contre un Postgres 16 local (schémas stub reconstruits) :
  les 7 migrations s'appliquent en séquence ; `pg_constraint` confirme
  exactement une FK `drivers → profiles` et une `rides → profiles` (pas
  d'ambiguïté pour PostgREST) ; une jointure `rides → profiles` (passager)
  et `rides → drivers → profiles` (chauffeur) sur des données réelles
  insérées localement retourne les bons `phone`/`full_name`.
- **Résultat** : collée et exécutée avec succès sur le projet réel.
  Débloque pour de bon l'identité passager/chauffeur sur tout futur écran
  (liste courses, paiements, etc.) sans requête manuelle supplémentaire.

---

## TASK-010 — Écran admin courses (liste + détail)

- **Objectif** : troisième tronçon du dashboard admin — visibilité
  opérationnelle sur les courses, sans dépendre de la décision
  cartographie (donc « Liste courses » plutôt que « Carte live »).
- **Statut** : Terminé (3 septembre 2026).
- **Fait** :
  - `/courses` : table filtrable (statut, catégorie, période, zone),
    passager/chauffeur affichés (identité via l'embed `profiles` remis en
    état par TASK-009), montant, mode/statut de paiement.
  - `/courses/$rideId` : trajet, montants (estimé/final), paiement,
    chronologie complète (`ride_status_history`).
  - Nouveaux composants `RideStatusBadge`/`PaymentStatusBadge`
    (`Badge.tsx`), types `RideListRow`/`RideStatus`/`Zone`/etc.
    (`lib/types.ts`), navigation ajoutée dans `Shell.tsx`.
- **Vérifié** : `tsc -b`, `vite build`, `oxlint` propres (même
  avertissement non bloquant déjà présent ailleurs — reset d'état au
  changement de filtre). Playwright/Chromium réel : les deux nouvelles
  routes protégées redirigent vers `/login` sans session ; avec une
  session simulée, les deux écrans se montent sans erreur JS (capture
  d'écran à l'appui, état d'erreur réseau affiché proprement).
- **Résultat** : confirmation bout-en-bout (données réelles) non testée
  depuis cet environnement (réseau vers `*.supabase.co` bloqué côté
  sandbox). Le filtre zone n'apparaît que si des zones existent en base
  (table vraisemblablement vide sur le projet réel à ce jour).

---

## TASK-011 — MCP Supabase connecté + durcissement des grants EXECUTE internes

- **Objectif** : le porteur du projet a connecté un serveur MCP Supabase à
  cette session (accès réel et direct au projet, plus besoin du
  copier-coller SQL Editor). Première action : `get_advisors` (recommandé
  après tout changement DDL) pour vérifier l'état de sécurité réel du
  projet.
- **Statut** : Terminé (3 septembre 2026).
- **Fait** :
  - Confirmé un seul projet visible côté MCP (`elrsjctwrvzglwogmmpq`, VTC
    Togo) — aucun risque de confusion avec l'autre projet Supabase.
  - `get_advisors` (sécurité) a trouvé 13 fonctions internes
    (`handle_new_user`, `generate_referral_code`,
    `log_ride_status_change`, `apply_rating_to_aggregate`,
    `increment_promotion_redemptions`, `flag_device_duplicate`,
    `notify_admins_on_sos`, `generate_invoice_on_ride_success`,
    `dispatch_push_notification` — toutes des fonctions trigger — plus
    `expire_subscriptions`/`cleanup_rate_limits` (`pg_cron`) et
    `dispatch_next_offer`/`expire_ride_offers_and_dispatch` (worker de
    dispatch, `service_role`)) exécutables en RPC direct
    (`/rest/v1/rpc/...`) par n'importe quel compte `authenticated`, et
    `dispatch_push_notification` même par `anon`. Cause racine : sur ce
    projet, `authenticated`/`anon` reçoivent EXECUTE de façon directe à la
    création de toute fonction `public` (privilège par défaut du projet,
    pas le mécanisme générique `PUBLIC` de Postgres) — migration 2 avait
    bien révoqué `anon` en bloc une fois, migration 3 avait correctement
    révoqué les deux pour ses fonctions internes, mais les fonctions
    trigger/cron de migration 2 elle-même et `dispatch_push_notification`
    (migration 5, créée après coup) avaient été oubliées.
  - Migration 8 (`00000000000008_revoke_internal_function_grants.sql`) :
    révoque EXECUTE sur ces 13 fonctions pour `public, anon, authenticated`
    — sans toucher aux grants `service_role` existants (worker) ni aux
    ~30 RPC client/admin légitimement `authenticated`-accessibles.
- **Vérifié** :
  - Une première version (revoke `from public` seulement) s'est révélée
    sans effet réel sur `authenticated` une fois appliquée au projet réel
    — repéré en revérifiant avec `has_function_privilege` plutôt que de
    faire confiance au `{"success":true}` de l'outil. Corrigée (`from
    public, anon, authenticated`), réappliquée, revérifiée : les 13
    fonctions passent bien à `false` pour `anon`/`authenticated`, restent
    `true` pour `service_role` là où c'est prévu (worker).
  - Les 6 migrations + la 7 + la 8 s'appliquent proprement en séquence
    contre un Postgres 16 + PostGIS local reconstruit (schémas
    `auth`/`net`/`storage` stub).
  - `admin_stats_overview`, `create_ride_request`, `submit_driver_application`
    restent bien `authenticated`-accessibles (non touchés).
  - `get_advisors` réexécuté : les 13 entrées ont disparu ; restent
    uniquement les warnings attendus (RPC client/admin intentionnels) et
    un `auth_leaked_password_protection` (réglage dashboard, pas une
    migration — voir `docs/STATUS.md` §3).
- **Résultat** : appliqué directement sur le projet réel via
  `apply_migration` (MCP) — plus besoin de demander au porteur du projet
  de coller quoi que ce soit pour ce type de changement désormais.

---

## TASK-012 — Révision d'architecture : app web + 4 plateformes unifiées

- **Objectif** : le porteur du projet a demandé une app web en plus des
  apps mobiles (« pour permettre à ceux qui n'ont pas de téléphone de
  commander directement sur le web »), et a redéfini la structure des
  livrables en 4 plateformes, chacune couvrant passager **et**
  chauffeur (sauf l'admin) : ① Web, ② Android, ③ iOS, ④ Admin.
- **Statut** : Documentation terminée (3 septembre 2026) ; `apps/web` en
  cours de scaffolding.
- **Fait** :
  - `docs/02-architecture-technique.md` : nouvelle section « Révision du
    3 septembre 2026 », tableau des choix de stack mis à jour (app
    mobile unique passager+chauffeur, app web ajoutée), diagramme
    d'ensemble et arborescence du monorepo mis à jour.
  - `apps/passenger/README.md` et `apps/driver/README.md` (READMEs
    seuls, aucun code — rien perdu) remplacés par `apps/mobile/README.md`.
  - `README.md` racine : arborescence `apps/` mise à jour (`web/`,
    `mobile/`, `admin/`), description de `apps/admin/` corrigée (elle
    listait encore « login + vue d'ensemble » seulement, alors que
    chauffeurs/KYC et courses sont construits depuis — corrigé au
    passage).
  - `docs/STATUS.md` réécrit (était monté à 221 lignes) pour refléter la
    révision sans repartir d'une page blanche — condensé le §5
    « Dernièrement terminé » en pointant vers le détail déjà présent
    dans ce fichier plutôt que de le dupliquer.
- **Décision notée** : ceci **inverse** un choix documenté et justifié
  lors du cadrage initial (`02-architecture-technique.md` disait
  explicitement « pas de bascule de mode dans une appli unique, pour
  garder chaque interface strictement focalisée sur son usage »).
  Signalé une fois au porteur du projet en conversation ; il a confirmé
  vouloir la nouvelle structure. Les jeux d'écrans passager/chauffeur
  documentés en `05-ecrans.md` restent distincts (seule la bascule de
  mode et le binaire sont désormais partagés) — pas de refonte du
  sitemap nécessaire.
- **Résultat** : voir TASK-013 pour `apps/web`.

---

## TASK-013 — Scaffold apps/web (première page publique)

- **Objectif** : premier tronçon de l'app web décidée en TASK-012 —
  répondre concrètement au besoin de commander sans smartphone.
- **Statut** : Terminé (3 septembre 2026) pour ce premier tronçon ; auth
  et demande de course restent à construire (dépendent de décisions pas
  encore prises — méthode OTP vs email, compte eSMS Africa).
- **Fait** :
  - `apps/web/` scaffoldé avec exactement la même stack que
    `apps/admin/` (React 19.2.8 + Vite 8.2.2 + TanStack Router 1.170 +
    Tailwind v4 + `@supabase/supabase-js` 2.114, mêmes fichiers de
    config copiés puis adaptés) et la même palette bleu nuit/or pour la
    cohérence de marque.
  - `/` : page d'accueil publique, deux entrées (« Je suis passager » /
    « Je suis chauffeur »).
  - `/passager`, `/chauffeur` : pages d'attente honnêtes (« bientôt
    disponible ») plutôt que des flux d'auth non testables — la
    méthode d'authentification passager (OTP téléphone via eSMS Africa,
    compte pas encore créé) et le contenu réel de ces écrans ne sont pas
    encore décidés.
- **Vérifié** : `tsc -b`, `vite build`, `oxlint` propres. Playwright/
  Chromium réel : accueil rendu correctement en desktop et mobile
  (390×844), navigation `/` → `/passager` par clic et accès direct à
  `/chauffeur`, aucune erreur JS sur les 3 pages.
- **Résultat** : première pierre de l'app web posée, vérifiée, poussée.
  Prochaine étape naturelle : décider la méthode d'auth passager, puis
  construire le flux de demande de course (dépend aussi de la décision
  cartographie, §7 de `docs/STATUS.md`, non tranchée).

---

## TASK-014 — Abandon d'eSMS Africa, auth par code email

- **Objectif** : le porteur du projet change de société et n'utilisera
  plus eSMS Africa — répercuter la décision partout où le SMS OTP était
  documenté comme méthode d'authentification, sans supprimer le circuit
  téléphone déjà construit en base (juste le mettre en réserve).
- **Statut** : Documentation terminée (3 septembre 2026) ; construction
  de l'auth email en cours (voir TASK-015).
- **Fait** : mis à jour partout où le SMS OTP était mentionné comme
  méthode d'auth — `docs/01-architecture-fonctionnelle.md`,
  `docs/02-architecture-technique.md` (nouvelle section « Révision
  authentification », tableau de stack, diagramme), `docs/04-parcours-utilisateur.md`
  (parcours passager et chauffeur), `docs/07-api.md` (section Auth +
  section vérification téléphone marquée « non utilisée, en réserve »),
  `docs/11-securite.md`, `docs/12-roadmap.md` (Phase 0), `README.md`
  (stack + structure), `docs/STATUS.md` (§1/§2/§3/§6/§7).
- **Décision notée** : conçu pour accueillir les deux moyens
  (email et téléphone), pas seulement l'email — `phone_verifications` et
  les Edge Functions `phone-verification-start`/`-check` restent en
  place, non appelées, réactivables sans réécriture le jour où un
  nouveau fournisseur SMS est choisi. Côté UI, seul l'email est proposé
  tant que le téléphone n'est pas fonctionnel (pas d'option visible mais
  désactivée, qui serait trompeuse pour un utilisateur réel).
- **Résultat** : voir TASK-015 pour la construction de l'écran
  `/passager` (`apps/web`) avec `signInWithOtp`/`verifyOtp`.

---

## TASK-015 — Auth passager par code email (`apps/web`)

- **Objectif** : premier flux fonctionnel de `apps/web` — permettre à un
  passager de créer un compte / se connecter par code email, suite à
  TASK-014.
- **Statut** : Terminé (3 septembre 2026) pour l'auth ; la demande de
  course reste à construire (dépend de la cartographie, non tranchée).
- **Fait** :
  - `/passager` : saisie email → `supabase.auth.signInWithOtp({ email,
    options: { shouldCreateUser: true } })` → saisie du code reçu →
    `supabase.auth.verifyOtp({ email, token, type: 'email' })` →
    redirection `/passager/accueil`.
  - `/passager/accueil` : protégée (`beforeLoad` redirige vers
    `/passager` sans session), placeholder honnête en attendant la
    demande de course.
  - `src/lib/useSession.ts` ajouté (même pattern que `apps/admin`).
- **Vérifié** :
  - `tsc -b`, `vite build`, `oxlint` propres.
  - Playwright/Chromium réel : `/passager/accueil` sans session redirige
    bien vers `/passager` ; la requête réelle `POST
    https://<projet>.supabase.co/auth/v1/otp` est interceptée et
    confirmée correctement formée (`email`, `create_user: true`) — échoue
    au niveau réseau (`Failed to fetch`, sandbox bloqué comme toujours),
    error state affiché proprement, formulaire reste utilisable.
    Deuxième écran (saisie du code) vérifié séparément avec une réponse
    `/auth/v1/otp` simulée réussie — rendu correct, aucune erreur JS.
- **Résultat** : la confirmation bout-en-bout (réception réelle du code
  par email, connexion effective) n'a pas pu être testée depuis cet
  environnement — à faire en lançant l'app en local chez vous. Prochaine
  étape naturelle : demande de course, une fois la cartographie décidée.

---

## TASK-016 — Décision cartographie : Google Maps

- **Objectif** : le porteur du projet a tranché Google Maps vs Mapbox
  (Google Maps retenu) — répercuter partout où la décision était
  documentée comme ouverte.
- **Statut** : Terminé (3 septembre 2026).
- **Fait** : `docs/STATUS.md` (§1/§3/§6/§7), `docs/02-architecture-technique.md`
  (tableau de stack), `supabase/functions/pricing-directions/index.ts`
  (commentaire en tête de fichier).
- **Résultat** : la demande de course côté passager reste bloquée en
  pratique — pas sur le choix, sur la clé API elle-même, jamais fournie.
  Demandée en détail (`docs/STATUS.md` §7) : une clé serveur
  (`GOOGLE_MAPS_API_KEY`, Directions API, déjà attendue par
  `pricing-directions`) et une clé client restreinte par referrer
  (Places API + Maps JavaScript API).

---

## TASK-017 — FK payments→profiles (migration 9) + écran admin Paiements

- **Objectif** : quatrième tronçon du dashboard admin — visibilité sur les
  paiements (course + abonnement chauffeur). Repéré en le préparant :
  `payments.user_id` référence `auth.users` directement (même défaut que
  `drivers.id`/`rides.passenger_id`, corrigé en TASK-009) — sans FK vers
  `public.profiles`, PostgREST ne peut pas embarquer l'identité du payeur.
- **Statut** : Terminé (3 septembre 2026).
- **Fait** :
  - Migration 9 (`00000000000009_payments_profile_embed_fk.sql`) — ajoute
    `payments.user_id → profiles.id` (FK additionnelle, aucune retirée),
    même correctif que la migration 7.
  - `/paiements` (`apps/admin`) : liste filtrable (statut, type
    course/abonnement, fournisseur, période), identité du payeur, montant,
    référence fournisseur, dates de création/confirmation, total des
    paiements réussis sur la période affichée. Nouveaux types
    (`PaymentListRow`/`PaymentPurpose`/`PaymentProvider`,
    `lib/types.ts`), nouveaux badges (`PaymentPurposeBadge`,
    `paymentProviderName`, `Badge.tsx`), navigation ajoutée dans
    `Shell.tsx`.
- **Vérifié** :
  - Migration rejouée contre un Postgres 16 + PostGIS local reconstruit
    (schémas `auth`/`net`/`storage` stub) : les 9 migrations s'appliquent
    en séquence ; `pg_constraint` confirme une seule FK
    `payments → profiles` en plus de celle vers `auth.users` (pas
    d'ambiguïté pour PostgREST) — puis appliquée et revérifiée à
    l'identique sur le projet réel via MCP (`apply_migration` +
    requête `pg_constraint` directe, pas seulement le `{"success":true}`
    de l'outil).
  - `tsc --noEmit`, `npm run build`, `npm run lint` (oxlint) propres
    (mêmes avertissements non bloquants déjà présents ailleurs — reset
    d'état au changement de filtre). Playwright/Chromium réel avec
    session et données `payments` simulées (réseau Supabase toujours
    bloqué côté sandbox) : filtres, badges de statut/type, identité du
    payeur et total des paiements réussis tous corrects (capture d'écran
    à l'appui).
- **Résultat** : `payments` peut désormais être embarqué avec `profiles`
  sur tout futur écran (le pattern TASK-009 s'applique maintenant aux
  trois tables qui en avaient besoin). Confirmation bout-en-bout avec de
  vraies données non testée depuis cet environnement (réseau sandbox).

---

## TASK-018 — FK invoices→profiles (migration 10) + écran admin Facturation

- **Objectif** : cinquième tronçon du dashboard admin — visibilité sur les
  factures générées automatiquement à la complétion d'une course. Même
  défaut repéré en le préparant : `invoices.passenger_id` référence
  `auth.users` directement (comme `payments.user_id` en TASK-017).
- **Statut** : Terminé (3 septembre 2026).
- **Fait** :
  - Migration 10 (`00000000000010_invoices_profile_embed_fk.sql`) —
    ajoute `invoices.passenger_id → profiles.id` (FK additionnelle,
    aucune retirée), même correctif que les migrations 7 et 9.
  - `/facturation` (`apps/admin`) : liste filtrable (mode de paiement,
    période), identité passager+chauffeur (`drivers.id → profiles`,
    déjà en place depuis TASK-009), montants transport/frais de
    service/total, numéro de facture, date d'émission, totaux agrégés
    sur la période affichée. Nouveau type `InvoiceListRow`
    (`lib/types.ts`), navigation ajoutée dans `Shell.tsx`.
- **Vérifié** :
  - Migration rejouée contre un Postgres 16 + PostGIS local reconstruit
    (10 migrations en séquence) ; `pg_constraint` confirme une seule FK
    `invoices → profiles` en plus de celle vers `auth.users` — puis
    appliquée et revérifiée à l'identique sur le projet réel via MCP.
  - `tsc --noEmit`, `npm run build`, `npm run lint` (oxlint) propres.
    Playwright/Chromium réel avec session et données `invoices`
    simulées : filtres, identités, totaux transport/frais de
    service/global tous corrects (capture d'écran à l'appui).
- **Résultat** : `docs/05-ecrans.md` écran #15 (Facturation — liste)
  fait. Table `invoices` vide sur le projet réel à ce jour (aucune
  course complétée avec paiement réussi depuis un vrai client) —
  confirmation bout-en-bout avec de vraies données non testée depuis cet
  environnement (réseau sandbox). Écran #16 (Facturation — détail) pas
  construit, non nécessaire dans l'immédiat (la liste affiche déjà tous
  les montants).

---

## TASK-019 — Écrans admin Abonnements (liste + plans)

- **Objectif** : sixième et septième tronçons du dashboard admin —
  visibilité sur les abonnements souscrits et gestion des plans
  (prix, actif/inactif). Aucune dépendance externe ni nouvelle FK
  nécessaire (`subscriptions.driver_id → drivers.id` a déjà son embed
  `profiles` réglé depuis TASK-009 ; `subscription_plans` est
  autonome).
- **Statut** : Terminé (3 septembre 2026).
- **Fait** :
  - `/abonnements` : liste filtrable (statut, catégorie), chauffeur,
    plan, prix, dates de début/expiration. Le filtre catégorie utilise
    `drivers!inner(...)` plutôt qu'un simple `drivers(...)` — sans le
    modificateur `!inner`, PostgREST ne filtre que le contenu de l'embed,
    pas les lignes `subscriptions` elles-mêmes (piège documenté, évité
    avant d'écrire le code plutôt que découvert en le testant).
  - `/abonnements/plans` : les 6 plans (voiture/moto-taxi × jour/7j/30j),
    modification du prix (`window.prompt`, validation entier positif) et
    bascule actif/inactif — écriture directe sur `subscription_plans`
    (RLS admin déjà en place depuis le schéma initial, aucune RPC à
    écrire). Garde-fou UI : activation refusée si le plan n'a pas de
    prix (reflète la contrainte SQL `subscription_plans_active_price_chk`
    plutôt que de laisser l'utilisateur découvrir l'erreur serveur).
  - Nouveaux types (`SubscriptionListRow`/`SubscriptionPlan`/
    `SubscriptionStatus`, `lib/types.ts`), nouveau badge
    (`SubscriptionStatusBadge`, `Badge.tsx`), navigation ajoutée dans
    `Shell.tsx`.
- **Vérifié** :
  - `tsc --noEmit`, `npm run build`, `npm run lint` (oxlint) propres.
  - Playwright/Chromium réel : `/abonnements` avec données simulées (2
    abonnements, statuts/catégories/prix corrects) ; `/abonnements/plans`
    avec les 6 **vrais** plans du projet réel (lus via MCP juste avant,
    prix/statuts exacts reproduits) — les deux écrans et la navigation
    entre eux (lien « Gérer les plans » / « Retour ») rendus sans erreur
    JS, capture d'écran à l'appui pour chacun.
- **Résultat** : `docs/05-ecrans.md` écrans #12 et #13 faits. Actions
  d'écriture (prix, actif/inactif) non testées bout-en-bout avec de
  vraies requêtes réseau depuis cet environnement (réseau sandbox) — le
  code suit exactement le pattern déjà vérifié en conditions réelles
  ailleurs (écriture directe filtrée par RLS, comme `DriverDetail.tsx`).

---

## TASK-020 — Écran admin Règlements (liste + génération + marquage payé)

- **Objectif** : huitième tronçon du dashboard admin — visibilité et
  action sur les créances de frais de service par chauffeur
  (`settlements`). Aucune dépendance externe ni nouvelle FK nécessaire
  (`settlements.driver_id → drivers.id` a déjà son embed `profiles`
  réglé depuis TASK-009 ; les écritures passent entièrement par RPC,
  déjà construites en migration 2).
- **Statut** : Terminé (3 septembre 2026).
- **Fait** :
  - `/reglements` : un seul écran couvrant les 3 maquettés dans
    `docs/05-ecrans.md` (#17 liste, #18 nouveau, #19 détail) — le
    « détail » se limite à l'action « marquer payé », inutile d'ouvrir
    une route séparée pour ça (choix délibéré, pas un oubli).
  - Liste filtrable par statut (en attente/réglé), affiche chauffeur,
    catégorie, période, nombre de courses, brut transport, frais de
    service, statut, date/méthode de règlement.
  - Formulaire « Nouveau règlement » (panneau dépliable) : sélection
    chauffeur (approuvés uniquement) + période (dates) → RPC
    `admin_create_settlement`.
  - Action « Marquer payé » par ligne : méthode demandée
    (`window.prompt`), confirmation, RPC `admin_mark_settlement_paid` —
    même pattern que `DriverDetail.tsx` (busy state, erreur inline).
  - Nouveaux types (`SettlementListRow`/`SettlementStatus`/
    `DriverForSettlement`, `lib/types.ts`), navigation ajoutée dans
    `Shell.tsx`.
- **Vérifié** :
  - `tsc --noEmit`, `npm run build`, `npm run lint` (oxlint) propres
    (un avertissement `react(purity)` réel trouvé et corrigé au passage
    — `Date.now()` appelé directement dans un argument `useState`,
    corrigé en initialiseur paresseux `useState(() => ...)`).
  - Playwright/Chromium réel avec RPC `admin_create_settlement`/
    `admin_mark_settlement_paid` simulées côté réseau : génération d'un
    règlement (formulaire → nouvelle ligne visible), marquage payé
    (ligne disparaît du filtre « en attente »), les deux vérifiés
    bout en bout au niveau du flux applicatif (réseau Supabase réel
    toujours hors de portée du sandbox).
- **Résultat** : `docs/05-ecrans.md` écrans #17-19 faits. Confirmation
  avec de vraies requêtes RPC contre le projet réel non testée depuis
  cet environnement (réseau sandbox).

---

## TASK-021 — FK user_roles→profiles (migration 11) + écrans admin Utilisateurs

- **Objectif** : neuvième et dixième tronçons du dashboard admin —
  visibilité et action sur les comptes (`profiles`). Même défaut repéré
  en le préparant : `user_roles.user_id` référence `auth.users`
  directement (comme les migrations 7/9/10 avant elle).
- **Statut** : Terminé (3 septembre 2026).
- **Fait** :
  - Migration 11 (`00000000000011_user_roles_profile_embed_fk.sql`) —
    ajoute `user_roles.user_id → profiles.id` (FK additionnelle, aucune
    retirée), même correctif que les migrations 7/9/10.
  - `/utilisateurs` : liste avec recherche nom/téléphone (debounce
    300ms), filtre statut actif/suspendu, rôles en badges.
  - `/utilisateurs/$userId` : profil, historique des courses (en tant
    que passager, via `rides.passenger_id`), action suspendre/réactiver
    (RPC `admin_suspend_user`/`admin_unsuspend_user`, motif demandé à la
    suspension) — même pattern que `DriverDetail.tsx`.
  - Nouveaux types (`UserListRow`/`UserDetail`/`UserRideHistoryRow`/
    `AppUserRole`, `lib/types.ts`), nouveau badge (`UserRoleBadge`,
    `Badge.tsx`), navigation ajoutée dans `Shell.tsx`.
- **Vérifié** :
  - Migration rejouée contre un Postgres 16 + PostGIS local reconstruit
    (11 migrations en séquence) ; `pg_constraint` confirme une seule FK
    `user_roles → profiles` en plus de celle vers `auth.users` — puis
    appliquée et revérifiée à l'identique sur le projet réel via MCP.
  - `tsc --noEmit`, `npm run build`, `npm run lint` (oxlint) propres.
    Playwright/Chromium réel avec les **6 vrais profils** du projet
    (lus via MCP juste avant, dont 2 comptes créés en testant l'auth
    passager en local chez le porteur du projet — voir plus bas) :
    liste, détail, historique de courses, action suspendre — tous
    vérifiés.
  - Un vrai bug trouvé et corrigé **dans le script de vérification
    lui-même** (pas dans le code applicatif) : le mock réseau renvoyait
    un tableau pour une requête `.single()`, alors que PostgREST renvoie
    un objet nu dans ce cas (`Accept:
    application/vnd.pgrst.object+json`) — `user.id.slice(...)` plantait
    sur un tableau sans `.id`. Bon rappel que les mocks de vérification
    doivent reproduire fidèlement le contrat PostgREST, pas juste
    répondre 200.
- **Résultat** : `docs/05-ecrans.md` écrans #3-4 faits. Le porteur du
  projet a lancé `apps/web` en local pendant cette tâche et créé deux
  comptes réels via `/passager` (email OTP fonctionnel de bout en bout
  hors sandbox, première confirmation réelle de ce flux) — visibles
  dans `/utilisateurs` (`e30c474a...`, `594619db...`), sans nom/téléphone
  puisque l'inscription par email seul ne les renseigne pas.

---

## TASK-022 — Écran admin Liste véhicules

- **Objectif** : onzième tronçon du dashboard admin — recherche de
  véhicules par plaque. Contrairement aux écrans précédents, aucune
  migration nécessaire : `vehicles.driver_id → drivers.id → profiles.id`
  était déjà réglé par la migration 7.
- **Statut** : Terminé (3 septembre 2026).
- **Fait** : `/vehicules` — recherche par plaque (debounce 300ms),
  catégorie du chauffeur (badge), lien vers `/chauffeurs/$driverId`.
  Nouveau type `VehicleListRow` (`lib/types.ts`), navigation ajoutée
  dans `Shell.tsx`.
- **Vérifié** : `tsc --noEmit`, `npm run build`, `npm run lint` (oxlint)
  propres. Playwright/Chromium réel avec les **3 vrais véhicules** du
  projet (lus via MCP juste avant) : liste et recherche par plaque
  toutes deux correctes.
- **Résultat** : `docs/05-ecrans.md` écran #8 fait.

---

## TASK-023 — Écrans admin Zones + Tarification

- **Objectif** : douzième et treizième tronçons du dashboard admin.
  Aucune migration nécessaire pour les deux — `zones` est autonome,
  `pricing_rules.zone_id → zones` référence déjà la bonne table.
- **Statut** : Terminé (3 septembre 2026).
- **Fait** :
  - `/zones` : liste + création (nom, ville, horaires de majoration
    nuit), activer/désactiver. La frontière géographique (`boundary`,
    colonne PostGIS) n'est pas éditable ici — nécessite une carte,
    bloquée par la clé Google Maps (limitation affichée dans l'écran
    lui-même). Écriture directe (RLS admin déjà en place).
  - `/tarification` : historique des règles de prix par catégorie/zone,
    badge « Actuelle »/« Historique » calculé côté client avec la même
    logique que `estimate_ride_fare` (zone spécifique prioritaire sur
    zone globale, date d'effet la plus récente déjà passée).
    Formulaire de création — jamais de modification en place par design
    du schéma (`pricing_rules` n'a pas de policy `UPDATE`, seulement
    `INSERT`/`SELECT`).
  - Nouveaux types (`Zone` étendu, `PricingRule`, `lib/types.ts`),
    navigation ajoutée dans `Shell.tsx` (×2).
- **Vérifié** : `tsc --noEmit`, `npm run build`, `npm run lint` (oxlint)
  propres. Playwright/Chromium réel : Zones (état vide, création,
  activer/désactiver) et Tarification (badge actuelle/historique
  correct sur deux règles de dates différentes, création d'une nouvelle
  règle) — tout vérifié bout en bout (réseau Supabase simulé).
- **Résultat** : `docs/05-ecrans.md` écrans #20-21 faits. **Découverte
  en construisant l'écran** : `pricing_rules` est vide sur le projet
  réel — `estimate_ride_fare` échouera pour toute catégorie tant
  qu'aucune règle n'est créée (`raise exception
  'no_pricing_rule_configured'`), indépendamment de la clé Google
  Maps. Un vrai deuxième blocage pour la demande de course, noté dans
  `docs/STATUS.md` §3 — se résout en 30 secondes une fois l'écran
  utilisé (créer au moins une règle « toutes zones » par catégorie).

---

## TASK-024 — FK reports/sos_alerts→profiles (migration 12) + écran Réclamations & SOS

- **Objectif** : quatorzième tronçon du dashboard admin — file priorisée
  des alertes SOS et réclamations, avec résolution. Même défaut repéré
  en le préparant : `reports.reporter_id`/`reports.reported_user_id` et
  `sos_alerts.triggered_by` référencent `auth.users` directement (comme
  les migrations 7/9/10/11 avant elle).
- **Statut** : Terminé (3 septembre 2026).
- **Fait** :
  - Migration 12 (`00000000000012_reports_sos_profile_embed_fks.sql`) —
    3 FK additionnelles vers `public.profiles` (aucune retirée).
  - `/reclamations` : alertes SOS actives en tête (fond rouge, action
    « Résoudre » en un clic — `admin_resolve_sos`), réclamations
    ensuite, ouvertes avant résolues/rejetées (`admin_resolve_report`,
    notes optionnelles à la résolution/rejet). Un seul écran couvre
    liste + détail + résolution, comme pour Règlements (TASK-020).
  - `reports` a deux FK vers `profiles` (reporter et signalé) : embed
    désambiguïsé par nom de contrainte
    (`profiles!reports_reporter_id_profiles_fkey` /
    `!reports_reported_user_id_profiles_fkey`) — sans ce hint, PostgREST
    ne peut pas savoir laquelle des deux relations utiliser et
    l'embedding échoue.
  - Nouveaux types (`SosAlertRow`/`ReportRow`/`ReportStatus`/
    `SosStatus`, `lib/types.ts`), nouveaux badges (`SosStatusBadge`/
    `ReportStatusBadge`, `Badge.tsx`), navigation ajoutée dans
    `Shell.tsx`.
- **Vérifié** :
  - Migration rejouée contre un Postgres 16 + PostGIS local reconstruit
    (12 migrations en séquence) ; `pg_constraint` confirme les 3 FK
    supplémentaires — puis appliquée et revérifiée à l'identique sur le
    projet réel via MCP.
  - `tsc --noEmit`, `npm run build`, `npm run lint` (oxlint) propres.
    Playwright/Chromium réel avec SOS + réclamation simulées (embed à
    deux relations inclus) : les deux sections, résolution SOS (l'alerte
    disparaît du filtre actif), prise en charge d'une réclamation
    (statut passe à « En cours ») — tout vérifié.
- **Résultat** : `docs/05-ecrans.md` écran #22 fait. `reports`/
  `sos_alerts` vides sur le projet réel — confirmation avec de vraies
  données non testée depuis cet environnement (réseau sandbox).

---

## TASK-025 — Écran admin Fraude

- **Objectif** : quinzième tronçon du dashboard admin — file de revue
  des signalements anti-fraude (`fraud_flags`). Aucune migration
  nécessaire : `subject_id` est volontairement polymorphe
  (user/driver/device, texte) par design du schéma initial, pas de FK à
  ajouter.
- **Statut** : Terminé (3 septembre 2026).
- **Fait** : `/fraude` — filtres statut (ouvert par défaut) et sévérité,
  type + id du sujet signalé, raison, décision (mettre en revue/
  confirmer/rejeter) via `admin_resolve_fraud_flag`, notes optionnelles
  à la décision. Nouveaux types (`FraudFlagRow`/`FraudSubjectType`/
  `FraudFlagStatus`/`FraudSeverity`, `lib/types.ts`), nouveaux badges
  (`FraudFlagStatusBadge`/`FraudSeverityBadge`, `Badge.tsx`), navigation
  ajoutée dans `Shell.tsx`.
- **Vérifié** : `tsc --noEmit`, `npm run build`, `npm run lint` (oxlint)
  propres. Playwright/Chromium réel : filtres, badges sévérité/statut,
  action confirmer (le signalement disparaît du filtre « Ouvert ») —
  vérifiés bout en bout (réseau Supabase simulé).
- **Résultat** : `docs/05-ecrans.md` écran #23 fait. `fraud_flags` vide
  sur le projet réel — confirmation avec de vraies données non testée
  depuis cet environnement (réseau sandbox). **Note d'ergonomie** : la
  barre de navigation admin compte maintenant 13 entrées et passe sur
  deux lignes en desktop standard — un futur regroupement (menu
  déroulant par domaine : Financier, Modération, Configuration) serait
  utile une fois tous les écrans posés, pas urgent.

---

## TASK-026 — Écran admin Statistiques globales (dashboard admin complet)

- **Objectif** : seizième et dernier tronçon du dashboard admin —
  revenus par jour et rétention chauffeurs. Aucune migration
  nécessaire.
- **Statut** : Terminé (3 septembre 2026).
- **Fait** :
  - `/statistiques` : sélecteur de période (7/30/90 jours) ; revenus
    par jour — frais de service (`invoices.platform_fee_fcfa`) et
    abonnements (`payments` où `purpose='driver_subscription'` et
    `status='success'`), jamais fusionnés, agrégés côté client par jour
    (aucune RPC de série temporelle n'existe — direct query + `Map`
    JS, portée délibérément plus modeste que « croissance » au sens
    analytics complet, mais honnête et exacte) ; rétention chauffeurs
    par catégorie — part des chauffeurs `approved` ayant un abonnement
    `active` (`drivers` vs `subscriptions!inner(category)`, même motif
    d'embed filtré que `Subscriptions.tsx`, TASK-019).
- **Vérifié** : `tsc --noEmit`, `npm run build`, `npm run lint` (oxlint)
  propres. Playwright/Chromium réel avec données simulées construites
  pour piéger un bug d'agrégation (3 factures sur 2 jours distincts,
  montants non ronds) : regroupement par jour correct (2 lignes),
  totaux exacts (193/1 500/1 693 FCFA), rétention exacte (50 % voiture,
  0 % moto) — tout vérifié bout en bout (réseau Supabase simulé).
- **Résultat** : `docs/05-ecrans.md` écran #24 fait — **les 24 écrans
  du dashboard admin documentés sont maintenant tous construits**
  (connexion, vue d'ensemble, utilisateurs, chauffeurs/KYC, véhicules,
  courses, paiements, facturation, abonnements liste+plans, règlements,
  zones, tarification, réclamations & SOS, fraude, statistiques —
  18 écrans réels sur 24 lignes du tableau, certaines lignes du tableau
  ayant été fusionnées en un seul écran quand le « détail » ne
  justifiait pas une route séparée : Règlements TASK-020, Réclamations
  & SOS TASK-024). Reste hors dashboard admin : `apps/web` (demande de
  course, bloquée sur Google Maps + `pricing_rules`), `apps/mobile`
  (pas commencé), le worker de dispatch (écrit, pas déployé).

---

## TASK-027 — Bootstrap du premier compte admin (super_admin)

- **Objectif** : débloquer la vérification bout-en-bout des 24 écrans
  admin — le porteur du projet a donné l'email à utiliser
  (`abotchigilles@yahoo.fr`).
- **Statut** : Terminé (3 septembre 2026).
- **Fait** : vérifié que ce compte existait déjà côté `auth.users`
  (c'est l'un des deux comptes créés par le porteur du projet en
  testant `/passager` en local, TASK-021 — email confirmé) ; inséré
  `('594619db-16a4-49f0-a207-641c32643308', 'super_admin')` dans
  `public.admin_roles` via MCP (`execute_sql`), suivant exactement le
  bootstrap documenté dans `apps/admin/README.md` §Bootstrap ; revérifié
  par une jointure `admin_roles`/`auth.users` sur l'email.
- **Point d'attention signalé** : ce compte a été créé via le flux
  passager par code email (`signInWithOtp`), pas via un formulaire
  email+mot de passe — `encrypted_password` est renseigné en base
  (`has_password: true`) mais rien ne garantit que ce soit un mot de
  passe que le porteur du projet connaît/a choisi (comportement
  standard Supabase pour un compte créé par OTP). Or `/login`
  (`apps/admin`) utilise `signInWithPassword`. À vérifier au premier
  essai de connexion — si ça échoue, réinitialiser le mot de passe
  depuis Dashboard → Authentication → Users.
- **Résultat** : `admin_roles` contient désormais un `super_admin`.
  Reste à confirmer que la connexion fonctionne réellement (mot de
  passe utilisable) — non testable depuis ce sandbox (réseau bloqué),
  à faire en local ou une fois le mot de passe réinitialisé.

---

## TASK-028 — Nav admin groupée par domaine + README rafraîchi

- **Objectif** : nettoyer la dette d'ergonomie signalée en TASK-025/026
  (barre de nav à 14 entrées, deux lignes) et corriger
  `apps/admin/README.md`, resté figé à l'état de TASK-006 (6 routes)
  malgré 18 tâches d'écrans construites depuis.
- **Statut** : Terminé (3 septembre 2026).
- **Fait** :
  - `Shell.tsx` : 14 liens plats → 6 entrées (Vue d'ensemble,
    Opérations, Financier, Configuration, Modération, Statistiques),
    les 4 groupes en menu déroulant (fermeture au clic extérieur ou à
    la navigation, surbrillance du groupe si un de ses écrans est
    actif).
  - `apps/admin/README.md` réécrit : tableau des 15 routes réelles,
    statut de vérification honnête (par écran, pas un blanc-seing),
    section bootstrap mise à jour (compte `abotchigilles@yahoo.fr`,
    TASK-027, avec le point d'attention mot de passe).
- **Vérifié** : `tsc --noEmit`, `npm run build`, `npm run lint` (oxlint)
  propres. Playwright/Chromium réel : 6 entrées top-level (comptées),
  menu déroulant s'ouvre/se ferme (clic sur le bouton, navigation vers
  un lien, clic à l'extérieur — les trois testés séparément),
  surbrillance du groupe actif confirmée sur `/paiements`.
- **Résultat** : plus de dette d'ergonomie/documentation ouverte sur le
  dashboard admin. Pas de blocage nouveau identifié.

---

## TASK-029 — apps/web : côté chauffeur complet (auth, onboarding, tableau de bord)

- **Objectif** : construire le pendant chauffeur de `apps/web`, jusque-là
  un simple `ComingSoon` — authentification, dépôt de dossier KYC +
  véhicule, et le tableau de bord opérationnel (abonnement,
  disponibilité, offres de course, course en cours).
- **Statut** : Terminé (3 septembre 2026).
- **Fait** :
  - `DriverLogin.tsx` : identique à `PassengerLogin.tsx` (code par email
    en deux étapes), route `/chauffeur`.
  - `DriverOnboarding.tsx` : formulaire catégorie/ville/véhicule →
    `submit_driver_application`.
  - `DriverHome.tsx` : tableau de bord unique qui bascule selon
    `driver.status` et l'état de l'abonnement/course — dépôt de
    documents, message si suspendu, section abonnement (achat en mode
    manuel), bascule disponibilité, offres de course en attente
    (rafraîchies par Realtime sur `ride_offers`/`rides`), course en
    cours (`mark_driver_arrived` → `start_ride` → `complete_ride`).
  - `router.tsx` : routes `/chauffeur` et `/chauffeur/accueil` ajoutées,
    `ComingSoon.tsx` supprimé (plus référencé).
- **Vérifié** : `tsc --noEmit`, `npm run build`, `npm run lint` propres.
  Playwright/Chromium réel avec mocks REST/RPC stateful (dossier soumis,
  documents envoyés, abonnement acheté, offre acceptée, course menée
  jusqu'à `complete_ride`) — assertions sur chaque transition d'état.
  Realtime lui-même non testable depuis ce sandbox (WebSocket bloqué),
  mais tout le flux REST/RPC sous-jacent l'est.
- **Résultat** : côté chauffeur fonctionnellement complet, à l'exception
  de la confirmation admin des paiements manuels (TASK-030) et de la
  demande de course passager qui alimente les offres (TASK-031).

---

## TASK-030 — apps/admin : actions de confirmation manuelle des paiements

- **Objectif** : `Payments.tsx` était en lecture seule — fermer la boucle
  du paiement manuel (mode de secours tant qu'aucun fournisseur Mobile
  Money n'est branché, voir `docs/10-paiements.md`).
- **Statut** : Terminé (4 septembre 2026).
- **Fait** : colonne « Actions » avec trois boutons conditionnels au
  statut/type du paiement — Confirmer (`admin_manual_payment_confirm`,
  abonnement chauffeur uniquement — la RPC n'enveloppe que
  `confirm_subscription_payment`, jamais `confirm_ride_payment`),
  Marquer échoué (`admin_mark_payment_failed`, tout paiement en attente),
  Rembourser (`admin_refund_payment`, tout paiement réussi). Une note
  explicite s'affiche sur les paiements de course Mobile Money en
  attente : leur confirmation passe uniquement par le webhook fournisseur
  (`confirm_ride_payment`, réservée à `service_role` — vérification du
  montant/`ride_id` qu'un clic admin ne peut pas reproduire), l'admin peut
  seulement les marquer échoués si le webhook ne répond jamais.
- **Vérifié** : `tsc --noEmit`, `npm run build`, `npm run lint` propres.
  Playwright/Chromium réel avec mocks RPC stateful : bouton Confirmer
  absent sur une course Mobile Money en attente, présent sur un
  abonnement en attente ; les trois actions changent bien le statut
  affiché après rechargement.
- **Résultat** : écran Paiements pleinement actionnable en mode manuel.

---

## TASK-031 — apps/web : accueil passager réel + demande de course

- **Objectif** : remplacer le stub « bientôt disponible » de
  `PassengerHome.tsx` par un tableau de bord réel — historique des
  courses et flux complet de demande de course.
- **Statut** : Terminé (4 septembre 2026).
- **Fait** :
  - `PassengerHome.tsx` : suivi de la course en cours (statut, infos
    publiques du chauffeur une fois matché, annulation via
    `cancel_ride`) si une course est active ; sinon formulaire de
    demande — catégorie, adresses avec coordonnées saisies à la main
    (Google Places pas encore branché — placeholder explicite à
    l'écran), zone optionnelle, mode de paiement, estimation via
    l'Edge Function `pricing-directions` puis `create_ride_request` ;
    historique des courses terminées/annulées en dessous. Abonnement
    Realtime sur `rides` (filtre `passenger_id`).
  - Migration 13 : `get_ride_driver_public_info` /
    `get_ride_passenger_public_info` (fonctions `SECURITY DEFINER`) —
    RLS interdit tout accès direct passager↔chauffeur en dehors de
    ces champs publics (`docs/11-securite.md`). En vérifiant les
    grants réels post-application, repéré que l'embed
    `rides.profiles!passenger_id(...)` utilisé côté `DriverHome.tsx`
    (TASK-029) retournait déjà silencieusement `null` en production
    pour la même raison — corrigé dans le même mouvement.
  - Migration 14 : correctif de sécurité sur la migration 13 — la
    comparaison `<>` avec `auth.uid()` ne levait pas l'exception
    `not_authorized` pour un appel non authentifié (`NULL` traité comme
    faux par `plpgsql`), et `anon` reçoit `EXECUTE` par défaut sur ce
    projet (constat déjà fait en TASK migration 8). Passage à
    `is distinct from`, NULL-safe.
- **Vérifié** : migrations 13/14 rejouées en local (Postgres 16 réel,
  14 migrations dans l'ordre) avant application au vrai projet ; accès
  légitime (passager↔chauffeur assignés) et refus (tiers, anonyme)
  testés directement en SQL des deux côtés avant et après le correctif.
  `tsc --noEmit`, `npm run build`, `npm run lint` propres côté
  `apps/web`. Playwright/Chromium réel : formulaire → erreur claire si
  tarification non configurée → estimation → confirmation → carte de
  suivi → infos chauffeur après un rechargement simulant le matching →
  annulation → retour au formulaire ; historique affiché correctement.
- **Bloqueur non levé par cette tâche** : la demande de course échouera
  réellement tant que `GOOGLE_MAPS_API_KEY` n'est pas configurée
  (`pricing-directions` renvoie `not_configured`) et tant que
  `pricing_rules` n'est pas peuplée avec de vrais tarifs (décision
  business du porteur du projet, jamais inventée ici) — l'écran affiche
  un message clair dans les deux cas plutôt que d'échouer en silence.
- **Résultat** : parcours passager complet côté code ; bloqué en usage
  réel par les deux points ci-dessus, déjà signalés en TASK-après-021
  (clé Maps) et jamais résolus depuis (tarifs, jamais abordés).

---

## TASK-032 — Vrais tarifs (course + abonnement) et déblocage de la demande de course

- **Objectif** : câbler les vrais tarifs communiqués par le porteur du
  projet (jamais inventés — voir `CLAUDE.md`/§Règles) pour lever le
  blocage `pricing_rules` vide identifié en TASK-031.
- **Statut** : Terminé (4 septembre 2026).
- **Fait** :
  - Migration 15 : `pricing_rules` seedée — voiture 250 FCFA prise en
    charge + 250 FCFA/km, minimum 700 FCFA ; moto 100 FCFA prise en
    charge + 70 FCFA/km, pas de minimum ; majoration de nuit 10 %
    (22h-5h) pour les deux, pas de prix à la minute. `subscription_plans`
    corrigée : Pass Jour moto 500 → 300 FCFA (jamais confirmé
    précédemment) ; Pass Jour voiture (1000 FCFA) déjà correct.
  - Correctif d'architecture trouvé en câblant ces tarifs :
    `estimate_ride_fare` ne calculait la majoration de nuit que si une
    zone était fournie (lecture de `zones.night_start_time`/
    `night_end_time`) — la sélection de zone étant optionnelle côté
    passager (`PassengerHome.tsx`, TASK-031) et la table `zones` vide sur
    le projet réel, la majoration ne se serait jamais déclenchée en
    pratique. Ajout d'un repli sur la fenêtre 22h-5h quand aucune zone
    n'est fournie ; une zone spécifique garde la priorité si elle existe.
- **Vérifié** : migration rejouée en local (Postgres 16 réel, 15
  migrations dans l'ordre) avant application au projet réel. Calculs
  vérifiés (1500 FCFA/5km voiture, 240 FCFA/2km moto, clamp à 700 FCFA
  sur une course très courte), limites de la fenêtre de nuit testées
  (21h59/05h00 = jour, 22h00/03h00 = nuit), chemin avec zone toujours
  fonctionnel (non régressé), `create_ride_request` testé de bout en bout
  (n'échoue plus sur `no_pricing_rule_configured`). Appliqué au projet
  réel puis revérifié par requête directe (jamais fait confiance au
  `{"success":true}` seul).
- **Résultat** : le blocage `pricing_rules` (TASK-031 §Bloqueur) est levé.
  Seule la clé Google Maps reste bloquante pour la demande de course en
  usage réel (§7 de `STATUS.md`).

---

## TASK-033 — Démarrage apps/mobile (Expo) : accueil + auth passager/chauffeur

- **Objectif** : initialiser `apps/mobile` (React Native/Expo, un seul
  code Android+iOS, passager+chauffeur), resté un simple README jusqu'ici.
  Périmètre volontairement limité à la Phase 1 du plan (auth) — pas de
  duplication du travail déjà fait côté `apps/web`.
- **Statut** : Terminé (4 septembre 2026).
- **Fait** : scaffold Expo SDK 57 + TypeScript + Expo Router (fichiers
  `app/`) ; accueil avec bascule de rôle ; authentification par code
  email en deux étapes (composant partagé `EmailOtpAuth.tsx`, port direct
  de `PassengerLogin.tsx`/`DriverLogin.tsx` d'`apps/web`) ; garde de
  session sur les 4 routes ; accueils passager/chauffeur en stub
  volontaire (contenu réel déjà construit côté web, à porter
  progressivement). Fichiers de config template retirés
  (`AGENTS.md`/`CLAUDE.md`/`.claude/`/`LICENSE`, non pertinents pour ce
  monorepo).
- **Vérifié** : `tsc --noEmit` et `oxlint` propres. Aucun émulateur natif
  disponible dans cet environnement — vérifié via `expo start --web`
  (react-native-web) + Playwright/Chromium réel : navigation accueil →
  connexion passager/chauffeur, appel réel `signInWithOtp` déclenché
  (échec propre sur le réseau sandboxé, `*.supabase.co` inaccessible —
  attendu, l'écran affiche une erreur claire), gardes de session sur les
  deux routes `/accueil` testées sans session active (redirection vers la
  connexion confirmée). Rendu natif réel sur simulateur/appareil **non
  vérifié** — à faire dès qu'un environnement avec Expo Go ou un
  simulateur est disponible.
- **Résultat** : `apps/mobile` n'est plus un dossier vide. Aucun compte
  Expo/EAS requis à ce stade (Expo Go/mode web suffisent en
  développement) — seulement pour un build natif installable, plus tard.
  Prochaines tâches naturelles : portage du tableau de bord chauffeur et
  de la demande de course passager depuis `apps/web`.

---

## TASK-034 — Portage du tableau de bord chauffeur + demande de course vers apps/mobile

- **Objectif** : porter `DriverHome.tsx` et `PassengerHome.tsx` (déjà
  construits et vérifiés côté `apps/web`, TASK-029/031-032) vers
  `apps/mobile`, complétant le périmètre au-delà de la Phase 1 (auth
  seule, TASK-033).
- **Statut** : Terminé (4 septembre 2026).
- **Fait** : port direct (mêmes RPC/Edge Function, même logique métier,
  seule la présentation change) — `app/chauffeur/accueil.tsx` (onboarding,
  documents via `expo-file-system` `File.pickFileAsync`/`.arrayBuffer()`
  sans dépendance séparée, abonnement, disponibilité, offres Realtime,
  course en cours) et `app/passager/accueil.tsx` (suivi de course,
  formulaire de demande avec `SelectField` — nouveau picker modal,
  React Native n'a pas de `<select>` —, estimation, historique). Nouveaux
  composants partagés `Badge.tsx`/`SelectField.tsx`/`DriverOnboarding.tsx` ;
  `types.ts`/`format.ts` copiés tels quels depuis `apps/web` (TS pur).
- **Vérifié** : `tsc --noEmit`/`oxlint` propres. Aucun émulateur natif
  disponible dans cet environnement (pas de SDK Android, pas d'Xcode) —
  vérifié via `expo start --web` + Playwright/Chromium, mocks REST/RPC,
  session simulée (AsyncStorage web = wrapper `localStorage`, confirmé en
  lisant sa source — même technique que pour `apps/web`) : onboarding,
  section documents (décompte/statuts), abonnement actif, disponibilité,
  offre acceptée → passager affiché → arrivée → démarrage → course
  terminée (Mobile Money) côté chauffeur ; formulaire, `SelectField`,
  erreur si tarification non configurée, estimation, confirmation, suivi,
  historique côté passager.
- **Limitation découverte et documentée** (`apps/mobile/README.md`) :
  `Alert.alert` (React Native) est un no-op complet sur `react-native-web`
  (confirmé en lisant sa source) — fonctionne normalement sur appareil
  réel, mais les trois confirmations qui en dépendent (achat d'abonnement,
  paiement cash confirmé, annulation de course) ne sont pas vérifiables
  dans ce mode web précisément à cause de cette limitation du mode de
  vérification, pas d'un défaut de l'app.
- **Résultat** : `apps/mobile` couvre désormais le même périmètre
  fonctionnel qu'`apps/web` pour passager et chauffeur. Rendu natif réel
  (simulateur/appareil), upload de document réel, et les trois
  confirmations `Alert.alert` restent à vérifier dès qu'un environnement
  avec Expo Go ou un simulateur est disponible.

---

## TASK-035 — Position du chauffeur (`update_driver_location`), web + mobile

- **Objectif** : aucun demandé explicitement — découvert en vérifiant si
  la RPC `update_driver_location` (existante et accordée depuis la
  migration 2, condition nécessaire au matching via `dispatch_next_offer`
  — voir `docs/08-matching.md`) était appelée depuis un client. Réponse :
  nulle part, ni côté `apps/web` ni côté `apps/mobile`, sur aucune des
  deux plateformes construites ce jour. Sans cet appel, aucun chauffeur
  ne peut jamais être matché à une course en production, quel que soit
  l'état de la clé Google Maps ou des tarifs — un blocage plus grave et
  jusque-là invisible.
- **Statut** : Terminé (4 septembre 2026).
- **Fait** : suivi de position en continu, foreground uniquement (jamais
  d'arrière-plan — hors périmètre, décision explicite), actif tant que
  `driver.status === 'approved' && driver.is_available`, y compris
  pendant une course en cours (`_ride_id` renseigné). Côté
  `apps/web/src/pages/DriverHome.tsx` : `navigator.geolocation.watchPosition`
  natif du navigateur. Côté `apps/mobile/app/chauffeur/accueil.tsx` :
  `expo-location` (`watchPositionAsync`), plugin ajouté à `app.json` avec
  le texte de permission `locationWhenInUsePermission`,
  `isIosBackgroundLocationEnabled`/`isAndroidBackgroundLocationEnabled`
  à `false`. Message d'erreur clair si la permission est refusée sur les
  deux plateformes.
- **Bug réel trouvé et corrigé au passage** : le premier appel
  `supabase.rpc('update_driver_location', ...)` dans la callback de
  position était une instruction nue, sans `await` ni `.then()` —
  `supabase-js` (`PostgrestBuilder`) est un thenable paresseux, la
  requête HTTP ne part que si `.then()`/`await` est effectivement invoqué
  ; l'appel ne partait donc tout simplement jamais. Corrigé via
  `void supabase.rpc(...).then(({ error }) => { ... })` (callback
  synchrone, pas de fonction `async` disponible à cet endroit). Un grep
  systématique de tous les appels `supabase.rpc(`/`supabase.from(` sur
  les trois apps (~35 occurrences) a confirmé que c'était un cas isolé —
  tous les autres étaient déjà correctement `await`és.
- **Vérifié** : `tsc --noEmit`/`oxlint` propres sur les trois apps.
  `expo-location` dispose d'une vraie implémentation web (API
  navigateur), donc testable via Playwright contrairement à `Alert.alert`
  — géolocalisation accordée (position simulée) → `update_driver_location`
  appelé avec les bonnes coordonnées, sur web et mobile ; refusée →
  message d'erreur clair affiché, aucun appel RPC déclenché. Testé dans
  les deux sens sur les deux plateformes.
- **Résultat** : le système de matching peut désormais fonctionner de
  bout en bout côté fourniture de position — ce volet ne dépend plus que
  de la clé Google Maps (estimation tarifaire) pour être utilisable en
  conditions réelles. Reste non vérifiable depuis cet environnement :
  rendu natif réel sur simulateur/appareil (§3/§7 de `docs/STATUS.md`).

---

## TASK-036 — Reçu PDF d'abonnement chauffeur (apps/web)

- **Objectif** : aucun demandé explicitement — `docs/10-paiements.md`
  §Historique et reçus documentait depuis le début du projet « un reçu
  simple est généré (PDF, `jsPDF`) pour chaque abonnement payé avec
  succès » comme si c'était déjà construit. Vérifié en cherchant `jsPDF`
  dans tout le dépôt : aucune occurrence — jamais construit, malgré la
  doc affirmant le contraire (et référençant en plus une route `/abonnement`
  qui n'a jamais existé, l'abonnement étant une section de `DriverHome.tsx`,
  pas une route séparée). Corrigé dans le même mouvement que la doc.
- **Statut** : Terminé (4 septembre 2026).
- **Fait** : `apps/web/src/lib/receipt.ts`
  (`generateSubscriptionReceiptPdf`, `jsPDF`, format A5) — reçu n°
  (préfixe de l'id du paiement), date, nom du chauffeur (`profiles.full_name`,
  lu directement — RLS `profiles_select` autorise déjà `auth.uid() = id`),
  plan (résolu depuis `payments.metadata.plan_id`/`plan_code`, écrit par
  `purchase_subscription`), mode de paiement, référence fournisseur le cas
  échéant, montant. Nouveau type `SubscriptionPayment`
  (`apps/web/src/lib/types.ts`). Section « Reçus » ajoutée dans
  `DriverHome.tsx` (liste des paiements `driver_subscription` réussis du
  chauffeur connecté, un bouton Télécharger par ligne) — requête directe
  sur `payments` filtrée `user_id`/`purpose`/`status`, autorisée par la
  policy `payments_select` existante (migration 1), aucune migration
  nécessaire.
- **Bug réel trouvé et corrigé en vérifiant** : les polices standard de
  jsPDF (encodage WinAnsi) ne savent pas rendre l'espace fine insécable
  (U+202F) qu'utilise `Intl.NumberFormat('fr-FR')` comme séparateur de
  milliers dans `fcfa()` — le montant s'affichait corrompu dans le PDF
  (`1 /000 FCFA` au lieu de `1 000 FCFA`), repéré en relisant le contenu
  réel du PDF généré, pas seulement en vérifiant qu'un fichier existait.
  `fcfa()` elle-même n'est pas en cause (correcte partout ailleurs, rendu
  navigateur) — corrigé localement dans `receipt.ts` (`pdfSafe()`,
  substitue l'espace fine insécable par un espace normal avant tout appel
  `doc.text()`), pas dans `format.ts`.
- **Poids du bundle corrigé au passage** : `jsPDF` embarque `html2canvas`
  + `dompurify` (plugin `.html()`, jamais utilisé ici) — l'import statique
  initial ajoutait ~380 Ko gzip au chunk principal d'`apps/web`, chargé
  par tout le monde (passager compris) alors que seul le tableau de bord
  chauffeur en a besoin. Remplacé par un `import()` dynamique déclenché
  seulement au clic sur Télécharger — `npm run build` confirme `jsPDF` et
  ses dépendances isolées dans un chunk séparé, chargé à la demande.
- **Vérifié** : `tsc --noEmit`/`oxlint` propres. Vérifié en conditions
  réelles (`npm run dev` + Playwright/Chromium, mocks REST réalistes,
  session simulée) : section « Reçus » affichée avec le bon plan/montant/
  date, clic sur Télécharger déclenche un vrai téléchargement, fichier
  récupéré et relu intégralement (pas seulement vérifié comme PDF valide
  — le contenu textuel a été relu pour confirmer que le bug d'encodage
  était réellement corrigé, avant et après le correctif).
- **Non fait** : la facture de course (`invoices`) reste sans rendu PDF —
  périmètre volontairement plus large, non traité ici (voir §Facturation
  du même document). Le reçu d'abonnement n'est pas encore porté sur
  `apps/mobile` (jsPDF fonctionne différemment en React Native — pas de
  téléchargement navigateur direct, nécessiterait `expo-file-system`/
  `expo-sharing` — non fait, hors périmètre de cette tâche).
- **Résultat** : `docs/10-paiements.md` reflète maintenant la réalité du
  code (reçu réellement construit, localisation corrigée). Décision prise
  au passage : ne pas créer `CHANGELOG.md` ni restructurer `STATUS.md`
  malgré sa longueur croissante (299+ lignes) — cette règle de seuil vient
  du `CLAUDE.md` du dépôt `mbonplan`, pas d'une règle propre à `vtc` (qui
  n'a pas de `CLAUDE.md`).

---

## TASK-037 — Facture PDF de course (`invoices`, apps/web passager)

- **Objectif** : `docs/10-paiements.md` §Facturation listait explicitement
  le rendu PDF de la facture comme un manque connu du MVP (« seule la
  ligne de données `invoices` est produite ») — comblé à la suite de
  TASK-036 (même besoin, même solution technique).
- **Statut** : Terminé (4 septembre 2026).
- **Fait** :
  - `apps/web/src/lib/pdf.ts` (nouveau) — extrait `pdfSafe()` de
    `receipt.ts` vers un module partagé (même correctif d'encodage
    jsPDF/espace fine insécable que TASK-036, maintenant utilisé par les
    deux générateurs plutôt que dupliqué).
  - `apps/web/src/lib/invoice.ts` (nouveau) — `generateRideInvoicePdf`
    (`jsPDF`, format A5) : numéro de facture, date d'émission, passager,
    chauffeur + véhicule/plaque (`get_ride_driver_public_info`, migration
    13 — fonctionne pour une course terminée, pas seulement active),
    trajet, distance, mode de paiement, référence, montants
    transport/frais de service/total — avec la mention explicite que le
    document est émis par la plateforme pour le compte du chauffeur
    (docs/01 §Rôle des parties).
  - Nouveau type `RideInvoice` (`lib/types.ts`) ; `RideHistoryRow` étendu
    de `final_distance_km`.
  - `PassengerHome.tsx` : après le chargement de l'historique, requête
    batch sur `invoices` (`passenger_id`/`ride_id in (...)`, policy
    `invoices_select` existante, migration 1 — aucune migration
    nécessaire) plutôt qu'une requête par course ; bouton « Facture »
    affiché seulement sur les lignes d'historique qui ont effectivement
    une facture (une course `completed` peut ne pas en avoir si le
    paiement a échoué) ; nom du passager chargé une fois
    (`profiles.full_name`, RLS `auth.uid() = id`).
- **Vérifié** : `tsc --noEmit`/`oxlint`/`npm run build` propres —
  `jsPDF` (chargé en `import()` dynamique, comme TASK-036) partagé entre
  `receipt.ts` et `invoice.ts` dans un seul chunk `pdf-*.js`, toujours
  hors du chunk principal. Playwright/Chromium réel : deux courses en
  historique (une avec facture, une annulée sans facture) — un seul
  bouton Facture affiché, sur la bonne ; clic → téléchargement réel →
  fichier récupéré et **son contenu texte intégralement relu** (tous les
  champs corrects, montants avec séparateur de milliers correctement
  rendu grâce à `pdfSafe()`).
- **Non fait** : pas de bouton Facture côté chauffeur (`DriverHome.tsx`
  n'a pas d'écran d'historique de courses — n'existe pas encore, hors
  périmètre de cette tâche) ni sur `apps/mobile`.
- **Résultat** : `docs/10-paiements.md` §Facturation et `docs/12-roadmap.md`
  mis à jour (l'item roadmap correspondant retiré, plus un manque). Les
  deux gaps de rendu PDF identifiés dans le projet (reçu d'abonnement,
  facture de course) sont maintenant comblés côté `apps/web`.

---

## TASK-038 — Écran Revenus + historique de courses chauffeur (`apps/web`)

- **Objectif** : `docs/05-ecrans.md` écran #18 (« Revenus ») documente
  « gains transport jour/semaine/mois (net des frais de service),
  historique de courses — jamais mélangé à l'abonnement » — jamais
  construit (`DriverHome.tsx` n'avait ni l'un ni l'autre, seulement la
  course active et les offres). Comble aussi le manque noté en fermant
  TASK-037 (pas de bouton Facture côté chauffeur, faute d'écran
  d'historique pour l'accrocher).
- **Statut** : Terminé (4 septembre 2026).
- **Fait** : nouvelle section « Revenus » dans `DriverHome.tsx` —
  - Trois tuiles (aujourd'hui / 7 derniers jours / ce mois-ci), calculées
    côté client à partir de `invoices.transport_amount_fcfa` (déjà net
    des frais de service par construction du schéma) sur une seule
    requête `invoices` bornée au mois en cours plutôt que trois
    requêtes séparées.
  - Liste d'historique des courses du chauffeur (`rides` filtré
    `driver_id`, 20 dernières terminées/annulées) — même structure que
    l'historique passager (`PassengerHome.tsx`, TASK-037).
  - Bouton « Facture » réutilisant `generateRideInvoicePdf` (TASK-037) :
    les infos chauffeur viennent de l'état local déjà chargé
    (`driver`/`driverName`, pas besoin d'appeler
    `get_ride_driver_public_info` sur soi-même) ; le nom du passager
    passe par `get_ride_passenger_public_info` (migration 13 — déjà
    utilisée pour la course active, fonctionne aussi pour une course
    terminée puisque la fonction ne restreint pas par statut).
  - Rafraîchi automatiquement sur le canal Realtime existant (`rides`
    table, même canal que les offres) après complétion d'une course.
- **Vérifié** : `tsc --noEmit`/`oxlint`/`npm run build` propres (jsPDF
  toujours isolé dans son chunk séparé, chargé à la demande — aucun
  changement à ce sujet). Playwright/Chromium réel : deux courses en
  historique (une terminée avec facture, une annulée sans facture) — un
  seul bouton Facture affiché, sur la bonne ; agrégats jour/semaine/mois
  vérifiés arithmétiquement corrects contre les factures simulées
  (course annulée exclue, comme attendu puisqu'aucune facture ne lui est
  jamais associée) ; téléchargement réel déclenché, **contenu du PDF
  intégralement relu** (véhicule/plaque du chauffeur, nom du passager via
  RPC, montants — tous corrects).
- **Résultat** : `docs/05-ecrans.md` écran #18 fait. Le chauffeur peut
  désormais télécharger la facture de ses propres courses, comme le
  passager (TASK-037) — plus de dissymétrie entre les deux côtés pour ce
  document. Reste non fait : `apps/mobile` (ni Revenus, ni facture).

---

## TASK-039 — Critère de fiabilité du matching + `pg_cron` réellement activé en production

- **Objectif** : demandé explicitement par le porteur du projet (via
  `AskUserQuestion` — le backlog facilement actionnable était épuisé,
  chaque piste restante avait un vrai compromis à trancher) : construire
  le critère de fiabilité du matching que `docs/08-matching.md` documente
  depuis le cadrage initial comme non fait au MVP.
- **Statut** : Terminé (4 septembre 2026).
- **Fait** : migration
  `00000000000016_driver_reliability_score.sql` —
  - `drivers.acceptance_rate`/`cancellation_rate` (`numeric(5,2)`,
    `null` sans donnée récente, jamais `0` — ne pas pénaliser un
    chauffeur sans historique par manque de données).
  - `recompute_driver_reliability()` : fenêtre glissante de 30 jours,
    `acceptance_rate` = part des offres résolues (`accepted`/`rejected`/
    `expired`, jamais `pending`) acceptées ; `cancellation_rate` = part
    des courses effectivement acceptées (`rides.driver_id` renseigné)
    annulées ensuite par le chauffeur lui-même
    (`status = 'cancelled_by_driver'`, jamais une annulation passager
    après acceptation du chauffeur). Recalcul périodique (`pg_cron`,
    toutes les 15 min) plutôt qu'en temps réel à chaque
    `ride_offers`/`rides` — évite d'alourdir le chemin chaud du dispatch
    pour une fraîcheur qui n'a pas besoin d'être seconde-près. Même
    schéma que `expire_subscriptions`/`cleanup_rate_limits` (migration
    2) : `SECURITY DEFINER`, EXECUTE révoqué pour `anon`/`authenticated`
    (même durcissement que migration 8).
  - `dispatch_next_offer` (migration 2) redéfinie : deux critères de
    classement insérés dans l'`ORDER BY`, juste après la distance
    (dominante) et avant la note — un chauffeur peu fiable fait perdre
    du temps au passager par construction (offre acceptée puis annulée),
    un risque plus direct pour l'issue du matching qu'une note plus
    basse. `coalesce(cancellation_rate, 0)`/`coalesce(acceptance_rate, 100)`
    pour qu'un chauffeur sans données récentes ne soit jamais désavantagé.
- **Vérifié en local** (Postgres 16 + PostGIS, 16 migrations rejouées en
  séquence) avant application au projet réel :
  - Deux chauffeurs à la **même position exacte** (distance neutralisée
    exprès) — l'un avec un historique fiable (4 courses acceptées, 0
    annulée → 100 %/0 %), l'autre peu fiable (1 offre acceptée puis
    annulée, 3 rejetées → 25 %/100 %) : `dispatch_next_offer` a
    systématiquement choisi le fiable.
  - Un troisième chauffeur sans aucun historique récent : taux restés
    `null` après recalcul (pas `0`) ; départagé équitablement contre le
    chauffeur fiable (même fiabilité coalescée) par la note
    (`rating_avg` plus élevé → choisi), confirmant qu'un chauffeur nouveau
    n'est jamais pénalisé par l'absence de données.
  - Grants vérifiés (`has_function_privilege`) : `recompute_driver_reliability`
    et `dispatch_next_offer` bien inaccessibles à `anon`/`authenticated`
    en RPC direct.
- **Découverte significative en vérifiant le déploiement réel** (jamais
  faire confiance à `{"success":true}` seul) : `pg_cron` n'était **jamais
  installé** sur le projet Supabase réel (`select 1 from pg_extension
  where extname='pg_cron'` → vide) — ni au moment de migration 2
  (`expire_subscriptions`/`cleanup_rate_limits`), ni jusqu'à aujourd'hui.
  Le garde `do $$ if exists(...) $$` de chaque migration empêchait
  l'erreur mais masquait silencieusement le problème : ces deux tâches
  n'ont **jamais tourné automatiquement en production** depuis le début
  du projet — un abonnement expiré ne repassait jamais `'expired'` tout
  seul (uniquement vérifié à l'instant du matching par
  `dispatch_next_offer`, donc sans conséquence fonctionnelle immédiate,
  mais l'état affiché en base restait faux), et `rate_limit_counters` ne
  se purgeait jamais.
  - Activer l'extension puis programmer des tâches qui modifient des
    données réelles en production dépassait le périmètre demandé
    (critère de fiabilité) — confirmé avec l'utilisateur via
    `AskUserQuestion` avant d'agir plutôt que de décider seul. Vérifié
    l'absence d'effet de bord avant d'activer (1 seul abonnement en
    base, actif et non expiré ; 0 ligne obsolète dans
    `rate_limit_counters`) puis programmé les trois tâches
    (`expire-subscriptions`, `cleanup-rate-limits`,
    `recompute-driver-reliability`) sur demande explicite.
  - Revérifié après coup que ce n'était pas qu'une programmation
    silencieuse : `cron.job_run_details` confirme `expire-subscriptions`
    (toutes les minutes) réellement exécutée avec succès, pas seulement
    listée dans `cron.job`.
- **Résultat** : `docs/08-matching.md`, `docs/06-schema-base-donnees.md`
  et `docs/STATUS.md` mis à jour. Le critère de fiabilité demandé est en
  place, et un vrai bug de production dormant depuis le tout début du
  projet (deux tâches de maintenance jamais exécutées) est corrigé au
  passage.

---

## TASK-040 — Repli `pg_cron` pour le balayage des offres expirées (worker jamais déployé)

- **Objectif** : aucun demandé explicitement — découvert en creusant le
  fonctionnement de `pg_cron` pour TASK-039. `services/matching-worker/`
  (processus Node.js dédié censé appeler
  `expire_ride_offers_and_dispatch()` toutes les ~5 s pour relancer le
  dispatch quand une offre expire sans réponse du chauffeur) n'a **jamais
  été déployé** — `docs/STATUS.md`/`docs/TASKS.md` (TASK-006) le
  documentaient déjà comme « écrit, pas déployé », mais sans que la
  gravité concrète soit mise en évidence : sans lui, une course dont le
  chauffeur assigné ne répond jamais à l'offre (téléphone éteint, app
  fermée) reste bloquée en `'searching'` **pour toujours** — rien ne
  relance jamais le dispatch vers le candidat suivant. Un vrai trou de
  production, pas un manque de finition esthétique.
- **Statut** : Terminé (4 septembre 2026), en solution de repli — le
  worker dédié reste à déployer.
- **Fait** : `services/matching-worker/README.md` affirmait que `pg_cron`
  ne pouvait pas descendre sous la minute (« sa granularité minimale est
  la minute ») — raison invoquée pour justifier un processus séparé.
  Vérifié directement contre le projet réel que c'est faux :
  `cron.schedule(name, '5 seconds', ...)` est accepté et exécuté à la
  cadence exacte demandée (testé en direct avec un job temporaire,
  supprimé ensuite — quatre exécutions consécutives espacées exactement
  de 10 s dans `cron.job_run_details`). Migration
  `00000000000017_interim_cron_offer_sweep.sql` planifie
  `expire_ride_offers_and_dispatch()` (déjà idempotente et sûre en
  concurrence, `for update skip locked` — migration 2, aucune modification
  nécessaire) toutes les 5 s via `pg_cron`.
- **Décision prise avec le porteur du projet** : programmer une tâche
  `pg_cron` supplémentaire qui modifie des données réelles en production
  dépassait le périmètre de TASK-039 — confirmé via `AskUserQuestion`
  avant d'agir (précédent du même type que l'activation de `pg_cron`
  elle-même, TASK-039) plutôt que de décider seul. Solution de repli
  explicitement temporaire, pas un remplacement du worker dédié — celui-ci
  reste la solution prévue une fois un VPS choisi (boucle applicative
  plus robuste, gestion d'erreurs/redémarrage `systemd`) ; les deux
  peuvent tourner en parallèle sans risque le jour venu grâce au
  `skip locked`, désactiver le repli n'est qu'une question de propreté.
- **Vérifié** : appliqué au projet réel via MCP puis revérifié directement
  dessus (pas seulement `{"success":true}`) — `cron.job` confirme la
  tâche `sweep-expired-ride-offers` active, `cron.job_run_details`
  confirme des exécutions réelles toutes les 5 s, statut `succeeded`.
- **Résultat** : `docs/08-matching.md`, `services/matching-worker/README.md`
  et `docs/STATUS.md` corrigés (l'affirmation fausse sur `pg_cron`
  supprimée des deux premiers). Le matching ne peut plus rester bloqué
  indéfiniment sur un chauffeur qui ne répond jamais — pire cas désormais
  ~20 secondes (15 s d'expiration + jusqu'à 5 s de balayage) au lieu
  d'indéfiniment.

---

## TASK-041 — Clé Google Maps obtenue et câblée

- **Objectif** : dernier blocage réel documenté du parcours passager
  (§3/§7 de `docs/STATUS.md` depuis TASK-016) — obtenir et câbler les
  clés Google Maps décidées le 3 septembre 2026.
- **Statut** : Terminé (5 septembre 2026).
- **Fait** :
  - Guidé le porteur du projet pas à pas dans Google Cloud Console
    (captures d'écran à l'appui, plusieurs allers-retours — l'interface a
    changé depuis la doc de TASK-016 : "Places API (New)" plutôt que
    l'ancienne "Places API", un menu déroulant plutôt qu'une section
    dédiée pour restreindre les API d'une clé).
  - Deux clés créées : **serveur** (Directions API uniquement, aucune
    restriction de referrer) et **client** (Places API (New) + Maps
    JavaScript API, restreinte par referrer HTTP).
  - Clé client mise en place directement — `apps/web/.env` et
    `apps/mobile/.env` (`VITE_GOOGLE_MAPS_API_KEY`/
    `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, noms nouveaux, ajoutés aux
    `.env.example` correspondants), jamais commitée (vérifié
    `git check-ignore`). `.env.example` racine mis à jour pour clarifier
    la séparation des deux clés (le commentaire précédent disait
    « décision à confirmer », périmé depuis le 3 septembre).
  - Clé serveur **transmise au porteur du projet pour configuration** —
    aucun outil MCP Supabase ne permet de gérer les secrets Edge
    Function (seuls `apply_migration`/`execute_sql`/`deploy_edge_function`
    disponibles, aucun equivalent `set_secret`) ; à faire uniquement
    depuis le Dashboard (Edge Functions → Secrets), comme documenté pour
    `PAYMENT_WEBHOOK_SECRET` en `docs/STATUS.md` §3.
- **Vérifié en conditions réelles**, pas seulement supposé configuré une
  fois le secret renseigné : le sandbox ne peut toujours pas contacter
  `*.supabase.co` directement (`curl` échoue à la connexion via le proxy
  agent) — contourné en appelant `pricing-directions` depuis la base
  elle-même via `net.http_post` (même technique que la vérification
  `push-notifications-dispatch` de TASK-006), réponse lue dans
  `net._http_response` plutôt que supposée. Résultat : `HTTP 200`, vraies
  données Google Directions (`distance_km`, `duration_min`), tarif
  calculé correctement par `estimate_ride_fare` (1,6 km à 250 FCFA/km
  ferait ~650 FCFA, le minimum voiture de 700 FCFA s'applique bien).
- **Résultat** : l'estimation/demande de course fonctionne désormais de
  bout en bout avec de vraies données, sur le projet réel. `docs/STATUS.md`
  §2/§3/§7 mis à jour (le blocage retiré de §3/§7, le succès documenté en
  §2). Reste à construire, non bloquant : l'autocomplétion d'adresse
  (Google Places) côté formulaire — `PassengerHome.tsx` (web et mobile)
  utilise encore une saisie manuelle des coordonnées lat/lng.

---

## TASK-042 — Écrans manquants construits (SOS, signalement, profil, onboarding, facturation détail, carte live)

- **Objectif** : audit honnête (grep sur le code réel, pas la mémoire ni
  la documentation) contre l'inventaire complet des écrans
  (`docs/05-ecrans.md`) a révélé 7 zones manquantes malgré des mois de
  travail — demandé explicitement par le porteur du projet de tout
  construire d'un coup plutôt que les traiter une par une.
- **Statut** : Terminé (5 septembre 2026).
- **Fait** (un commit par sous-partie, `git log` pour le détail exact) :
  - **SOS** (`trigger_sos`, migration 18, RPC déjà testée localement à 5
    scénarios avant application) — bouton transverse dans l'en-tête
    passager/chauffeur (pas seulement pendant une course), web et mobile,
    confirmation puis géolocalisation ponctuelle. Migration appliquée au
    projet réel et revérifiée (grants `anon=false`/`authenticated=true`
    sur les deux nouvelles fonctions) ; `trigger_sos` volontairement pas
    testée en conditions réelles pour ne pas déclencher une vraie alerte
    au staff (`notify_admins_on_sos`, trigger existant, migration 1),
    seul `admin_active_rides_locations` (lecture seule) a été appelé pour
    de vrai.
  - **Signalement** (écran #14) — formulaire catégorie + description,
    depuis la course en cours ou l'historique, `reports` (insert direct,
    RLS déjà permissive depuis la migration 1, aucune RPC nécessaire),
    web et mobile, passager et chauffeur.
  - **Fiabilité chauffeur** — `acceptance_rate`/`cancellation_rate`
    (calculés depuis TASK-039, migration 16, jamais affichés) enfin
    montrés sur le tableau de bord chauffeur, web et mobile.
  - **Profil/Paramètres** (écran transverse) — édition nom/langue via
    `profiles` (colonnes déjà ouvertes en écriture par
    `profiles_update_own`, migration 1), accessible même avant
    approbation du dossier chauffeur, web et mobile, passager et
    chauffeur.
  - **Onboarding + Profil initial passager** (écrans #1/#4) — écran
    d'accueil (logo/proposition de valeur) avant la saisie email ;
    capture nom/langue après le tout premier code vérifié, seulement si
    `profiles.full_name` est encore `null` (`handle_new_user`, migration
    1, ne le renseigne jamais) — un compte déjà complété passe
    directement au tableau de bord. Chauffeur non touché : son propre
    onboarding (catégorie/documents/véhicule) existe déjà.
  - **Admin Facturation — détail** (écran #16) — route
    `/facturation/$invoiceId` : montants, mode/référence de paiement,
    trajet facturé (embed `rides`).
  - **Admin Carte live des courses** (écran #10) — Leaflet + tuiles
    OpenStreetMap plutôt que Google Maps (usage interne staff, pas besoin
    de Places/Directions, évite une troisième clé Google Maps) ; s'appuie
    sur `admin_active_rides_locations()` (migration 18) ; sondage 10 s
    (RPC calculée, pas une table sur laquelle s'abonner en Realtime) ;
    icônes emoji personnalisées plutôt que les marqueurs par défaut de
    Leaflet (chemins d'image cassés une fois packagés par Vite).
  - **Explicitement laissé de côté** : « Moyens de paiement » (écran
    transverse listé dans `docs/05-ecrans.md`) — aucun moyen de paiement
    n'est enregistré dans ce système, le mode (cash/Mobile Money) est
    choisi à chaque course, pas de quoi construire un écran dédié tant
    que cette conception ne change pas.
- **Vérifié** :
  - `apps/web`, `apps/mobile`, `apps/admin` : `tsc`/`build`/`oxlint`
    propres après chaque sous-partie (pas un seul passage global à la
    fin).
  - Migration 18 : revérifiée directement contre le projet réel (grants
    + appel réel sur la fonction en lecture seule), pas seulement
    `{"success":true}`.
  - Carte live : navigation réelle vers `/carte` en Chromium headless —
    redirection correcte vers `/login` en l'absence de session, aucune
    erreur JS au chargement du module (confirme que Leaflet/react-leaflet
    ne casse pas le bundle).
  - **Non vérifiable depuis ce sandbox** : rendu réel de la carte avec
    des données (pas de mot de passe admin utilisable, réseau bloqué vers
    `*.supabase.co` — limitation déjà documentée, pas nouvelle) ;
    Facturation détail sur une vraie facture (aucune n'existe encore en
    production, aucune course payée terminée à ce jour).
- **Résultat** : les 7 zones identifiées par l'audit sont construites.
  `docs/05-ecrans.md` est désormais couvert en quasi-totalité côté code
  (l'autocomplétion d'adresse Google Places reste la seule pièce
  visuelle non construite, non bloquante, voir TASK-041).

---

## TASK-043 — Sélecteur de position sur carte (géolocalisation) — apps/web

- **Objectif** : demande explicite du porteur du projet en testant
  `apps/web` en local — au Togo, la plupart des gens ne maîtrisent pas
  les coordonnées latitude/longitude. Remplacer la saisie manuelle par
  une géolocalisation + un point choisi sur une carte.
- **Statut** : Terminé (5 septembre 2026).
- **Fait** :
  - `LocationPicker` (`apps/web/src/components/LocationPicker.tsx`) :
    bouton « Ma position » (`navigator.geolocation`), carte Google Maps
    (Maps JavaScript API, clé client déjà obtenue TASK-041) avec repère
    déplaçable, clic sur la carte pour ajuster le point. Remplace les 6
    champs texte (adresse + latitude + longitude ×2) de
    `PassengerHome.tsx` par deux `LocationPicker` (départ/destination).
  - **Décision** : pas d'auto-complétion Google Places malgré la clé déjà
    configurée pour ça — la compatibilité du composant `Autocomplete`
    historique avec une clé restreinte à « Places API (New) » n'est pas
    garantie, et beaucoup de lieux au Togo ne sont de toute façon pas
    indexés. Le texte d'adresse reste un champ libre (jamais écrasé une
    fois tapé à la main), préconfiguré par géocodage inverse en
    best-effort seulement.
  - **Deux bugs réels trouvés par le porteur du projet en testant** (pas
    par moi, mon sandbox ne peut pas contacter `maps.googleapis.com`,
    voir Vérifié ci-dessous) :
    1. Carte visible uniquement en minuscule vignette au centre du
       cadre. Premier correctif tenté (`ResizeObserver` +
       `google.maps.event.trigger(map, 'resize')`) insuffisant.
    2. **Vraie cause** : le reset Tailwind (`img { max-width: 100% }`)
       s'applique aux `<img>` internes que Google Maps utilise pour ses
       tuiles. Correctif standard documenté par Google :
       `.gm-style img { max-width: none }` (`apps/web/src/index.css`).
- **Vérifié** : `tsc`/`build`/`oxlint` propres à chaque étape. Le
  chargement réel du script Maps JavaScript API n'est pas vérifiable
  depuis ce sandbox — `$HTTPS_PROXY/__agentproxy/status` confirme des
  tunnels fermés côté proxy vers `maps.googleapis.com` (même catégorie de
  blocage que `*.supabase.co`), alors qu'un `curl` simple obtient une
  vraie réponse. Testé et corrigé en conditions réelles uniquement grâce
  aux retours du porteur du projet (captures d'écran).
- **Résultat** : demande de course utilisable sans connaître de
  coordonnées. Ne couvre que `apps/web` — `apps/mobile` reste en saisie
  manuelle (voir TASK-044 si porté).

---

## TASK-044 — Sélecteur de position sur carte porté vers apps/mobile

- **Objectif** : même besoin que TASK-043, côté `apps/mobile`.
- **Statut** : Terminé côté code (5 septembre 2026) — non vérifié en
  conditions réelles (voir Vérifié ci-dessous).
- **Fait** :
  - `apps/mobile/src/components/LocationPicker.tsx` : `react-native-webview`
    plutôt que `react-native-maps` — ce dernier demanderait un rebuild
    natif (config plugin + dev client), hors du workflow Expo Go managé
    utilisé pour ce projet jusqu'ici. La WebView charge une page HTML
    embarquée qui utilise le même Maps JavaScript API que `apps/web`
    (même clé cliente, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`).
  - « Ma position » utilise `expo-location` (déjà une dépendance,
    permission déjà éprouvée ailleurs dans ce projet) plutôt que la
    géolocalisation web du navigateur interne à la WebView — plus fiable
    à câbler côté `react-native-webview`. Position poussée dans la
    WebView via `postMessage` une fois obtenue côté natif.
  - Contournement TypeScript nécessaire : `WebView<P = undefined>` de
    cette librairie résout en props `never` une fois utilisé en JSX sans
    generic explicite (bug de typage connu de la lib, sans rapport avec
    ce projet) — recast une fois en haut du fichier plutôt qu'à chaque
    usage.
  - `PassengerHome` (mobile) : mêmes deux `LocationPicker` (départ/
    destination) que la version web, remplaçant les 6 champs `TextInput`
    (adresse + latitude + longitude ×2).
- **Vérifié** : `tsc`/`oxlint` propres. **Non vérifiable depuis ce
  sandbox** (aucun émulateur Android/iOS, et accès direct à
  `maps.googleapis.com` bloqué par la politique réseau, voir TASK-043) :
  le rendu réel de la carte dans la WebView, et la compatibilité de
  `react-native-webview` avec Expo Go en mode managé (normalement
  couverte par les modules natifs qu'Expo Go embarque, mais jamais
  confirmée sur ce projet précis) restent à tester sur un vrai appareil
  via Expo Go.
- **Résultat** : parité de code avec `apps/web` pour ce besoin. À
  confirmer par un test réel avant de considérer la fonctionnalité
  utilisable côté mobile.

---

## TASK-045 — Enregistrement du jeton push (apps/mobile) — jamais fait jusqu'ici

- **Objectif** : découverte en auditant les notifications push (pas une
  demande explicite) — le pipeline serveur existe et « fonctionne »
  depuis des mois (`push-notifications-dispatch`, vérifié par un test
  `net.http_post` en TASK-006) mais aucun client n'a jamais écrit
  `profiles.push_token` (colonne prête depuis la migration 4, accordée
  en écriture depuis le premier jour). Vérifié sur le projet réel : 0
  profil sur 6 avec un jeton — aucune notification n'a donc jamais pu
  être livrée à un vrai appareil, malgré la fonctionnalité documentée
  comme fonctionnelle.
- **Statut** : Terminé côté code (5 septembre 2026) — bloqué en pratique
  par deux points externes (voir ci-dessous).
- **Fait** :
  - `apps/mobile/src/lib/pushNotifications.ts` :
    `registerForPushNotifications(userId)` — permission
    (`expo-notifications`), jeton (`getExpoPushTokenAsync`), écriture sur
    `profiles.push_token`. Appelé une fois après connexion, écran
    d'accueil passager et chauffeur.
  - Best-effort strict : toute erreur (permission refusée, projet Expo
    absent) est journalisée (`console.warn`) et n'interrompt jamais le
    reste de l'app — une fonctionnalité annexe ne doit pas bloquer le
    parcours principal.
  - `expo-notifications` ajouté aux dépendances et aux `plugins` de
    `app.json` (configuration Android/iOS correcte pour un futur build
    natif).
- **Bloqué par (externe, pas du code)** :
  1. **`EXPO_PUBLIC_PROJECT_ID` jamais fourni** — aucun projet Expo créé
     pour ce produit sur expo.dev. Sans cette valeur,
     `registerForPushNotifications` abandonne silencieusement (pas
     d'erreur visible, juste aucun jeton enregistré). Nécessite un compte
     Expo gratuit + `npx eas init`.
  2. **Limite propre à Expo, pas à ce projet** : depuis le SDK 53, Expo
     Go ne reçoit plus les notifications push distantes sur Android — un
     build de développement (`eas build --profile development`) sera
     nécessaire pour tester la réception réelle une fois le jeton obtenu,
     Expo Go seul ne suffira plus à ce stade-là.
- **Vérifié** : `tsc`/`oxlint` propres. Aucun test réel possible depuis ce
  sandbox (pas de projet Expo à utiliser, aucun émulateur).
- **Résultat** : le pipeline push est maintenant réellement câblé de bout
  en bout côté code ; reste un point de configuration (compte Expo) et
  un test réel (build de développement) avant qu'une notification puisse
  effectivement arriver sur un téléphone.

---

## TASK-046 — Boîte de notifications in-app (jamais construite)

- **Objectif** : découverte en auditant TASK-045 — `public.notifications`
  (RLS + grants complets : chacun lit les siennes, peut marquer comme lu)
  est prête depuis la toute première migration et alimentée par une
  dizaine de déclencheurs (statuts de course, matching, abonnement,
  fiabilité, SOS), mais aucun client (web, mobile, admin) ne l'a jamais
  lue. Le push était le seul canal de diffusion envisagé — sans lui
  (jamais livré avant TASK-045), ces événements n'avaient tout simplement
  aucune vitrine, y compris pour un utilisateur web qui ne recevra jamais
  de push Expo de toute façon.
- **Statut** : Terminé (5 septembre 2026).
- **Fait** :
  - `apps/web/src/components/Notifications.tsx` (`NotificationsBell`) et
    `apps/mobile/src/components/Notifications.tsx`
    (`NotificationsButton`) : cloche avec badge non-lu dans l'en-tête,
    liste des 30 dernières notifications (realtime sur les nouvelles
    insertions via `postgres_changes`), marquer une ou toutes comme lues
    (`read_at`).
  - Web : panneau déroulant (comme les menus admin existants). Mobile :
    `Modal` en bas d'écran (même famille que `ReportModal`/`ProfileModal`).
  - Ajouté dans les 4 en-têtes (passager/chauffeur, web/mobile).
  - **Aucune migration nécessaire** — RLS (`notifications_select_own`/
    `notifications_update_own`) et grants (`select`, `update (read_at)`)
    déjà en place depuis la migration 1, seul le frontend manquait.
- **Vérifié** : `tsc`/`build`/`oxlint` propres sur `apps/web` et
  `apps/mobile`. Pas de vérification en conditions réelles possible
  depuis ce sandbox (mêmes limitations que d'habitude — réseau
  Supabase/Google bloqué, pas d'émulateur mobile) ; le schéma RLS/grants
  utilisé est inchangé et déjà éprouvé ailleurs dans ce projet
  (`profiles`, `reports`), pas de risque de sécurité nouveau.
- **Résultat** : les notifications déjà générées côté serveur sont enfin
  visibles quelque part, indépendamment du sort des notifications push
  (TASK-045, toujours bloquées par un projet Expo manquant).

---

## Gabarit pour une nouvelle tâche

```markdown
## TASK-XXX — Titre court

- **Objectif** : ...
- **Priorité** : haute / moyenne / basse.
- **Statut** : À analyser / À faire / En cours / Bloqué / À vérifier / Terminé.
- **Fichiers concernés** : ...
- **Dépendances** : ...
- **Résultat** : (rempli une fois Terminé — résumé court + pointeur vers le détail)
```
