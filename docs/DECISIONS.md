# Décisions d'architecture et de conception

Journal des choix structurants et de leur raison — pour qu'une future
session (vous ou une nouvelle conversation Claude) comprenne *pourquoi*
sans devoir relire tout l'historique de `docs/TASKS.md`. Complété au fil
de l'eau, jamais réécrit rétroactivement.

## Code partagé web/mobile jamais extrait (6 septembre 2026)

**Contexte** : le monorepo prévoyait dès le départ trois packages
partagés — `packages/api-client` (client Supabase + appels RPC
communs), `packages/shared-types` (types TypeScript générés depuis le
schéma), `packages/ui` (composants visuels partagés entre `apps/web` et
`apps/mobile`). Les trois sont restés des dossiers vides (un seul
README chacun, marqué « non initialisé ») pendant toute la
construction du projet.

**Constat** : à la place, chaque fonctionnalité côté mobile a été
construite comme un « port direct » du code web équivalent — 8
composants dupliqués mot pour mot (`Badge`, `LocationPicker`,
`Notifications`, `Profile`, `RatingModal`, `Report`, `Sos`, `Support`)
et `lib/types.ts` identique à ~90 % entre les deux apps.

**Décision** : supprimer les trois dossiers `packages/` plutôt que de
les peupler rétroactivement. Raisons :
- La duplication actuelle fonctionne et est déjà vérifiée (voir
  `docs/TASKS.md` TASK-050) — extraire maintenant demanderait de
  toucher les 8 composants + tous leurs points d'usage, un risque de
  régression pour un bénéfice avant tout esthétique à ce stade.
- `apps/web` (React DOM) et `apps/mobile` (React Native) ont des
  primitives d'interface différentes (`div`/`button` vs
  `View`/`Pressable`) — un composant visuel réellement partagé n'est
  possible qu'en réécrivant les deux avec une bibliothèque
  d'abstraction supplémentaire, un chantier à part, pas un simple
  déplacement de fichiers.
- Seul `shared-types` (TypeScript pur, aucun code visuel) aurait pu
  être extrait à faible risque — jugé pas prioritaire avant le
  lancement, à reconsidérer si la duplication devient une vraie source
  d'erreurs (un champ mis à jour d'un côté, oublié de l'autre).

**Si reconsidéré plus tard** : commencer par `shared-types` seul (le
plus sûr), jamais les trois d'un coup.
