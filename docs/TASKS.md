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
