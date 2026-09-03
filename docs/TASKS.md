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
- **Résultat** : migration prête à coller (< 1 Ko, un seul morceau).
  Débloque pour de bon l'identité passager/chauffeur sur tout futur écran
  (liste courses, paiements, etc.) sans requête manuelle supplémentaire.

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
