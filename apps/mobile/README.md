# App Mobile (Android + iOS)

Application mobile React Native (Expo), un seul code pour Android et iOS
et pour les deux rôles — passager et chauffeur, avec bascule de mode à la
connexion — non initialisée.

Remplace `apps/passenger`/`apps/driver` (rôles séparés, un binaire chacun)
suite à la révision d'architecture du 3 septembre 2026 — voir
[`../../docs/02-architecture-technique.md`](../../docs/02-architecture-technique.md)
§Révision du 3 septembre 2026 pour la justification. Aucun code n'existait
encore dans les anciens dossiers (READMEs seulement), donc rien n'a été
perdu au renommage.

Démarre en **Phase 1** de [`../../docs/12-roadmap.md`](../../docs/12-roadmap.md),
une fois les fondations (Phase 0 : compte Expo/EAS, clé Google Maps) en
place. Écrans détaillés : [`../../docs/05-ecrans.md`](../../docs/05-ecrans.md)
§App Passager et §App Chauffeur (les deux jeux d'écrans restent
distincts — seule la bascule de mode et le binaire sont partagés).
