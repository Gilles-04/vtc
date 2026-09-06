# Suivi des tâches — VTC Togo

Tâches **en cours, à faire ou bloquées**. Une tâche terminée quitte ce
fichier et rejoint [`CHANGELOG.md`](CHANGELOG.md) (historique complet,
daté, jamais élagué) — ce fichier reste donc toujours court par
construction : s'il grossit, c'est qu'il y a du travail réel en attente,
pas un problème de rangement.

Idées non démarrées, pas encore de tâche définie : voir
[`12-roadmap.md`](12-roadmap.md) (structuré en phases plutôt qu'en
backlog libre).

---

Les tâches TASK-001 à TASK-051 sont toutes terminées et vérifiées, leur
détail complet est dans [`CHANGELOG.md`](CHANGELOG.md). Deux tâches
restent ouvertes ci-dessous, issues de la demande de réorganisation du
6 septembre 2026 ; le reste de ce qui manque avant le lancement réel
dépend de décisions externes (fournisseur Mobile Money, compte Expo,
etc.), pas de développement — voir [`STATUS.md`](STATUS.md) §7.

---

## TASK-052 — Découper les 4 fichiers d'écran trop volumineux

- **Objectif** : `apps/web/src/pages/DriverHome.tsx` (804 lignes),
  `apps/mobile/app/chauffeur/accueil.tsx` (759 lignes),
  `apps/mobile/app/passager/accueil.tsx` (568 lignes) et
  `apps/web/src/pages/PassengerHome.tsx` (565 lignes) mélangent
  plusieurs responsabilités (affichage, appels Supabase, état local) —
  les séparer en sous-fichiers par sujet (ex. `DriverHome/index.tsx` +
  `useDriverDashboard.ts` + sous-composants), sans changer le
  comportement.
- **Priorité** : basse (confort de maintenance, pas un bug ni un
  blocage — le code actuel fonctionne).
- **Statut** : À faire.
- **Fichiers concernés** : les 4 fichiers ci-dessus.
- **Dépendances** : aucune.
- **Vérification attendue** : `npm run verify` propre après chaque
  fichier découpé (un fichier = un commit), comportement identique
  vérifié par rendu réel (Playwright) là où c'est possible depuis ce
  sandbox.

## TASK-053 — Finaliser le déploiement Vercel (apps/web et apps/admin)

- **Objectif** : `apps/admin` est en cours de déploiement sur Vercel
  (projet créé, variables d'environnement recréées en type Plaintext
  après confusion avec le type Secret write-only) — la confirmation
  qu'un site fonctionnel se charge n'a pas encore été obtenue.
  `apps/web` n'a pas encore de projet Vercel du tout.
- **Priorité** : haute (bloque la mise en ligne réelle).
- **Statut** : Bloqué — nécessite les actions de Gilles dans l'interface
  Vercel (pas d'accès direct depuis cet environnement sans jeton API,
  voir `docs/STATUS.md` §7) ou la création d'un jeton API Vercel
  (`vercel.com/account/tokens`, 7 jours, compte personnel) pour que
  Claude puisse piloter le déploiement directement.
- **Fichiers concernés** : aucun (configuration côté Vercel, pas de
  code).
- **Dépendances** : aucune.
- **Vérification attendue** : site chargé sans erreur console, connexion
  réelle testée.

---

## Gabarit pour une nouvelle tâche

```markdown
## TASK-XXX — Titre court

- **Objectif** : ...
- **Priorité** : haute / moyenne / basse.
- **Statut** : À analyser / À faire / En cours / Bloqué / À vérifier / Terminé.
- **Fichiers concernés** : ...
- **Dépendances** : ...
- **Résultat** : (rempli une fois Terminé — résumé court + pointeur vers le détail, puis déplacé dans CHANGELOG.md)
```
