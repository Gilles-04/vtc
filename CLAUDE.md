# VTC Togo — repères pour Claude

Plateforme de VTC (voiture + moto-taxi) pour le marché togolais. React 19
+ Vite (web, admin), Expo/React Native (mobile), Supabase (Postgres +
PostGIS, Auth, Realtime, Storage, Edge Functions). Détails complets :
les 12 livrables de cadrage dans [`docs/`](docs/) (sommaire dans le
[README](README.md)).

**Avant de commencer une tâche, lire [`docs/STATUS.md`](docs/STATUS.md)**
— c'est l'état réel du projet (ce qui marche, ce qui est en cours, ce qui
bloque). Ne pas redemander à Gilles (porteur du projet, non développeur)
de réexpliquer le contexte général : il n'est pas développeur et attend
que ce fichier ait déjà été lu.

**Si Gilles dit « reprends le projet » ou équivalent** (nouvelle session,
aucune autre précision) : lire `docs/STATUS.md` en entier, puis la tâche
`En cours`/`À faire` la plus prioritaire dans
[`docs/TASKS.md`](docs/TASKS.md). Résumer en 3-4 phrases où en est le
projet et ce qui semble être la suite logique, puis proposer de
continuer ou demander confirmation si un choix reste ouvert — ne jamais
redemander le contexte général du projet, il est déjà dans ces deux
fichiers et dans [`docs/DECISIONS.md`](docs/DECISIONS.md) (pourquoi
certains choix ont été faits).

## Protocole avant / pendant / après une tâche

**Avant** : lire `docs/STATUS.md` et `docs/TASKS.md` (tâche en cours le
cas échéant) ; inspecter les fichiers concernés ; vérifier `git status`
et la branche courante ; reformuler l'objectif en une phrase ; signaler
les risques ou ambiguïtés avant d'agir plutôt qu'après.

**Pendant** : petits changements cohérents et vérifiables, pas une
modification massive d'un coup ; respecter l'organisation par domaine
déjà en place (`apps/<app>/src/pages/` — un fichier = un écran,
`apps/<app>/src/components/` — transverse, `apps/<app>/src/lib/` — un
fichier = un sujet, `supabase/migrations/` — une migration = un sujet) ;
ne jamais dupliquer inutilement la logique ; ne jamais introduire de
secret dans le dépôt ; ne jamais annoncer qu'un élément fonctionne sans
l'avoir vérifié ; mettre à jour `docs/TASKS.md` si la tâche y figure.

**Après**, pour toute tâche significative, un compte rendu lisible par un
non-développeur, avec ces symboles :

- ✅ validé
- ⚠️ attention / limite connue
- ❌ échec ou blocage
- ⏳ reste à faire
- 🔒 élément sensible (secret, donnée personnelle, action irréversible)

Contenu attendu : objectif traité, fichiers créés/modifiés/déplacés/
supprimés, impact fonctionnel, vérifications réellement exécutées
(résultats exacts, jamais supposés), risques ou limites restantes, état
Git, prochaine action recommandée. Pour un changement trivial (typo,
texte), une phrase suffit — pas la peine du formalisme complet.

Puis mettre à jour [`docs/STATUS.md`](docs/STATUS.md) (réécrit en
instantané, voir règle ci-dessous) et [`docs/TASKS.md`](docs/TASKS.md) si
la tâche y figure.

## Format de communication

Gilles pilote ce projet sans connaissance en développement. À chaque
étape qui le justifie, structurer la réponse ainsi :

1. **Résultat visé**
2. Constat
3. Action proposée
4. Risques
5. Vérification
6. Décision nécessaire — uniquement si une décision de sa part est
   réellement indispensable

Expliquer simplement tout terme technique employé pour la première fois.
Pas de jargon inutile ; réponse courte quand rien de plus n'est
nécessaire.

## Autonomie vs. décision requise

- Décision **purement technique et réversible** → trancher soi-même,
  expliquer le choix fait et pourquoi. Ne pas demander à Gilles d'arbitrer
  un détail technique qu'il ne peut pas évaluer.
- Décision pouvant **modifier fortement le produit, les données, le
  budget, la sécurité ou la production** → demander son accord avant
  d'agir.
- Quand plusieurs solutions existent, présenter au maximum trois options
  (avantages / inconvénients / risques / coût de maintenance) avec une
  recommandation claire — jamais une liste neutre sans avis.

## Interdictions absolues

- Supprimer un fichier ou une ressource Supabase (table, bucket,
  fonction) sans avoir vérifié son rôle réel : `grep` du nom littéral
  dans `apps/*/src` **et** vérification que la fonctionnalité
  correspondante n'a pas été reconstruite sous un autre nom peu après.
  Ne jamais qualifier une ressource d'« orpheline » sur la seule lecture
  des migrations SQL.
- Écraser une modification existante non comprise.
- Modifier directement la production sans passer par un commit vérifié.
- Exposer des clés, mots de passe, jetons ou données personnelles.
- Changer une configuration critique sans point de contrôle Git.
- Lancer une migration irréversible sans validation explicite de Gilles.
- Remplacer une fonctionnalité qui marche par une abstraction non testée.
- Refactoring massif sans contrôles intermédiaires (petits commits,
  chacun vérifié avant le suivant).

## Règles qui ont déjà mordu

- **`import.meta.env.VITE_*` n'est vérifié qu'à l'exécution dans le
  navigateur, jamais au build** — `tsc -b && vite build` réussit même
  sans aucune variable d'environnement présente (le `throw` de garde
  dans `src/lib/supabase.ts` ne s'exécute qu'au runtime). Un build vert
  ne prouve donc pas que les clés sont correctement configurées côté
  hébergeur (Vercel, etc.) — vérifier le site réellement chargé.
- **`gen_random_bytes()` vit dans le schéma `extensions`, pas `public`.**
  Toute fonction `SECURITY DEFINER` qui génère un token a besoin de
  `SET search_path = public, extensions[, private]`.
- **`packages/` (api-client, shared-types, ui) supprimés le 6 septembre
  2026** — jamais initialisés ; le code partagé web/mobile reste
  volontairement dupliqué (voir `docs/DECISIONS.md`). Ne pas les
  recréer sans relire cette décision.
- **`docs/STATUS.md` est un instantané, pas un journal** — le réécrire à
  chaque mise à jour significative, ne jamais empiler une nouvelle
  section datée par-dessus les précédentes. L'historique complet et daté
  vit uniquement dans [`docs/CHANGELOG.md`](docs/CHANGELOG.md).
- **`apps/mobile` n'a pas de script `build`** — une app Expo se
  construit avec `eas build` (compte Expo requis), pas avec un script
  npm ; le workflow CI ne construit donc que web/admin (tsc + lint
  seulement pour mobile).
- **Le compte admin (`abotchigilles@yahoo.fr`) a été créé comme
  passager** (code email), jamais via un formulaire mot de passe —
  `/login` échouera probablement tant que le mot de passe n'a pas été
  réinitialisé depuis Dashboard Supabase → Authentication → Users.
- **oxlint, pas ESLint** — configuration dans `apps/*/.oxlintrc.json`,
  identique dans les trois apps (`react/rules-of-hooks: error`).

## Vérification avant chaque commit

```sh
npm run verify            # web + admin + mobile, à la racine
npm run verify:web        # une seule app (verify:admin, verify:mobile)
```

Rejoue exactement les contrôles de
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) : `tsc --noEmit`,
`vite build` (web/admin), `oxlint`. Ne jamais pousser un commit avec
cette commande en échec.

Vérification par rendu réel (Chromium piloté par Playwright, requêtes
Supabase interceptées via `page.route()`) recommandée pour les écrans
critiques — méthode documentée dans `docs/CHANGELOG.md` TASK-050. Cet
environnement de développement n'a pas d'accès réseau au vrai projet
Supabase ni à Google Maps : ce qui ne peut pas être vérifié depuis ici
doit être dit explicitement, jamais supposé fonctionnel.

## Conventions

- Commits et documentation du dépôt : en français, un changement
  cohérent par commit, `git push` après chaque commit.
- RLS sur toutes les tables Supabase ; toute fonction SQL sensible :
  `SECURITY DEFINER` + `search_path` explicite.
- PDF : `jsPDF` (voir `apps/web/src/lib/pdf.ts`), jamais une autre
  bibliothèque de génération.
- Secrets : jamais commités. `.env.example` documente les noms de
  variables par app, jamais leurs valeurs.
