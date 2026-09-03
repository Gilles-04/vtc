# Suivi des tâches — VTC Togo

Tâches en cours ou récemment terminées. Idées non démarrées : voir
[`12-roadmap.md`](12-roadmap.md) (structuré en phases plutôt qu'en backlog
libre, le projet n'ayant pas encore de code applicatif).

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
