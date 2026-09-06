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

Les tâches TASK-001 à TASK-052 et TASK-055 sont toutes terminées et
vérifiées, leur détail complet est dans [`CHANGELOG.md`](CHANGELOG.md).
Deux tâches restent ouvertes ci-dessous ; le reste de ce qui manque
avant le lancement réel dépend de décisions externes (fournisseur
Mobile Money, compte Expo, etc.), pas de développement — voir
[`STATUS.md`](STATUS.md) §7.

---

## TASK-054 — Passer l'organisation Supabase au plan Pro (sauvegardes)

- **Objectif** : l'organisation Supabase de ce projet (`VTC-TOGO`) est
  sur le plan Free — confirmé par requête directe le 6 septembre 2026
  (`docs/audits/09-audit-backups-monitoring-dr.md`). Ce plan ne propose
  **aucune sauvegarde automatique** de la base de données (ni
  quotidienne, ni Point-in-Time Recovery). En cas d'incident, toute
  donnée réelle (comptes, courses, paiements, documents KYC) serait
  perdue définitivement, sans recours.
- **Priorité** : critique **avant tout lancement réel** — sans impact
  tant que seules des données de développement existent.
- **Statut** : Bloqué — décision de budget qui vous appartient, pas
  technique. Passer au plan Pro active les sauvegardes quotidiennes par
  défaut.
- **Fichiers concernés** : aucun (configuration côté Dashboard
  Supabase).
- **Dépendances** : aucune.
- **Vérification attendue** : une fois le plan changé, tester une
  restauration réelle (créer un projet de test, restaurer dedans,
  vérifier que l'application fonctionne dessus) avant de considérer le
  sujet clos — ne jamais supposer une sauvegarde fiable sans l'avoir vue
  fonctionner.

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
