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

- **Objectif** : `apps/admin` déployé sur Vercel et confirmé fonctionnel
  le 6 septembre 2026 (voir Résultat). `apps/web` n'a encore aucun
  projet Vercel.
- **Priorité** : haute (bloque la mise en ligne réelle d'`apps/web`).
- **Statut** : En cours — `apps/admin` terminé et vérifié, `apps/web`
  reste à créer (nécessite les actions de Gilles dans l'interface
  Vercel : **Add New → Project**, importer le dépôt `Gilles-04/vtc`,
  définir **Root Directory** = `apps/web`, ajouter les 3 variables
  d'environnement de `apps/web/.env.example`).
- **Fichiers concernés** : aucun (configuration côté Vercel, pas de
  code).
- **Dépendances** : aucune.
- **Vérification attendue (`apps/web`)** : site chargé sans erreur
  console, connexion réelle testée.
- **Résultat (`apps/admin`)** : deux blocages trouvés et corrigés en
  direct avec Gilles le 6 septembre 2026 — **Root Directory** non défini
  dans les réglages Vercel (causait un `404: NOT_FOUND`, corrigé en le
  mettant à `apps/admin`) puis **variables d'environnement présentes
  mais sans valeur** (`VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`
  vides, causait une page blanche identique au souci rencontré en local
  — corrigé en renseignant les valeurs réelles). Site vérifié
  fonctionnel par Gilles à `https://vtc-admin-*.vercel.app` (URL exacte
  générée par Vercel, change à chaque déploiement — domaine fixe pas
  encore configuré). Au passage, le compte admin
  (`abotchigilles@yahoo.fr`) avait un mot de passe généré automatiquement
  (créé à l'origine comme passager, jamais via un formulaire mot de
  passe) — aucune option de réinitialisation dans le tableau de bord
  Supabase utilisé, mot de passe défini directement en base via
  `extensions.crypt()`/`gen_salt('bf')` (méthode standard compatible
  avec le hachage de Supabase Auth). Connexion admin confirmée
  fonctionnelle.

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
