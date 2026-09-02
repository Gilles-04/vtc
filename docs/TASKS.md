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
