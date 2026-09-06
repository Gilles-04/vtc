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
| 9 | Audit sauvegardes, monitoring, logs et disaster recovery | `09-audit-backups-dr.md` | ⏳ À faire |
| 10 | Mode développeur autonome — projet propre de A à Z | — (appliqué en continu, pas un document séparé) | ⏳ En continu |
| 11 | Audit SEO intégral et optimisation complète du site | `11-audit-seo.md` | ⏳ À faire |
| 12 | Dossier documentaire complet et vivant du projet | `../` (structure `docs/` existante à compléter) | ⏳ À faire en dernier |

## Note sur l'étape 10

« Mode développeur autonome, projet propre de A à Z » n'est pas un
audit ponctuel mais une posture de travail (zéro trace d'IA dans le
dépôt, décisions techniques prises de manière autonome, rigueur
professionnelle) déjà largement en place dans ce projet (commits en
français sans mention d'IA côté message, `CLAUDE.md` documentant les
règles). Elle sera revue explicitement à l'étape 10 du pipeline pour
vérifier qu'aucune trace résiduelle ne subsiste avant la documentation
finale (étape 12), mais s'applique dès maintenant à toute correction
issue des audits 1 à 9.

## Suivi

Mis à jour après chaque audit terminé. Les corrections décidées par
chaque audit sont trackées dans [`docs/TASKS.md`](../TASKS.md) sous leur
propre numéro `TASK-XXX`, pas dans ce fichier.
