# Pipeline d'audits — VTC Togo

Suite de 12 audits demandés par Gilles le 6 septembre 2026, à exécuter
dans cet ordre exact. Chaque audit est un fichier séparé dans ce
dossier, méthode commune : lecture directe du code + interrogation
réelle du projet Supabase (MCP) + vérifications exécutées quand
possible (`npm run verify`, `npm audit`) — jamais d'invention, tout
écart signalé comme non vérifiable plutôt que supposé.

| # | Audit | Fichier | Statut |
|---|---|---|---|
| 1 | Audit intégral de production, fonctionnalité et mise en ligne | [`01-audit-production.md`](01-audit-production.md) | ✅ Terminé (6 sept. 2026) — verdict 🟠 NOT READY |
| 2 | Audit sécurité complet d'un site web en développement | [`02-audit-securite-web.md`](02-audit-securite-web.md) | ✅ Terminé (6 sept. 2026) — verdict 🟡 ACCEPTABLE AVEC CORRECTIONS MINEURES |
| 3 | Audit sécurité + configuration Supabase | [`03-audit-securite-supabase.md`](03-audit-securite-supabase.md) | ✅ Terminé (6 sept. 2026) — verdict 🟡 GO CONDITIONNEL |
| 4 | Audit architecture, scalabilité et maintenabilité | [`04-audit-architecture.md`](04-audit-architecture.md) | ✅ Terminé (6 sept. 2026) — sain, un point à mesurer (latence région Supabase) |
| 5 | Audit tests, qualité du code et fiabilité | [`05-audit-tests-qualite.md`](05-audit-tests-qualite.md) | ✅ Terminé (6 sept. 2026) — 5 tests réels ajoutés et intégrés au CI (0 → 5) |
| 6 | Audit performance et optimisation complète | [`06-audit-performance.md`](06-audit-performance.md) | ✅ Terminé (6 sept. 2026) — 2 causes racines trouvées (bundle admin non découpé par route, appels Storage N+1) |
| 7 | Audit UX/UI, accessibilité et expérience utilisateur | [`07-audit-ux-ui.md`](07-audit-ux-ui.md) | ✅ Terminé (6 sept. 2026) — bug de contraste réel trouvé et corrigé dans les 3 apps |
| 8 | Hardening et protection maximale d'un VPS Ubuntu en production | [`08-audit-hardening-vps.md`](08-audit-hardening-vps.md) | ✅ Terminé (6 sept. 2026) — **non applicable**, confirmé (aucun VPS pour ce projet) |
| 9 | Audit sauvegardes, monitoring, logs et disaster recovery | [`09-audit-backups-monitoring-dr.md`](09-audit-backups-monitoring-dr.md) | ✅ Terminé (6 sept. 2026) — 🔴 **critique** : projet Supabase sur plan Free, aucune sauvegarde |
| 10 | Mode développeur autonome — projet propre de A à Z | [`10-audit-mode-developpeur-autonome.md`](10-audit-mode-developpeur-autonome.md) | ✅ Terminé (6 sept. 2026) — dépôt propre, une tension disclosée (attribution Git, hors de mon autorité à changer seul) |
| 11 | Audit SEO intégral et optimisation complète du site | `11-audit-seo.md` | ⏳ À faire |
| 12 | Dossier documentaire complet et vivant du projet | `../` (structure `docs/` existante à compléter) | ⏳ À faire en dernier |

## Note sur l'étape 10

« Mode développeur autonome, projet propre de A à Z » n'est pas
seulement un audit ponctuel mais une posture de travail (décisions
techniques prises de manière autonome, rigueur professionnelle,
absence de trace superflue) déjà appliquée en continu aux audits 1 à 9.
Traitée explicitement dans
[`10-audit-mode-developpeur-autonome.md`](10-audit-mode-developpeur-autonome.md) :
dépôt structurellement propre, avec une tension disclosée plutôt que
cachée (les pieds de page `Co-Authored-By` dans l'historique Git — une
contrainte de la session en cours, pas un choix fait sur ce projet).

## Suivi

Mis à jour après chaque audit terminé. Les corrections décidées par
chaque audit sont trackées dans [`docs/TASKS.md`](../TASKS.md) sous leur
propre numéro `TASK-XXX`, pas dans ce fichier.
