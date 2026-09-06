# Audit 5/12 — Tests, qualité du code et fiabilité

*Réalisé le 6 septembre 2026. Contrairement aux audits précédents,
celui-ci ne se limite pas à un constat : une vraie suite de tests a été
ajoutée, exécutée réellement, et vérifiée sans régression avant d'être
committée (voir §2). Méthode : inventaire exhaustif de l'existant,
ajout de tests pour les scénarios les plus critiques et tractables
depuis cet environnement, exécution réelle, documentation honnête de ce
qui reste hors d'atteinte ici et pourquoi.*

---

## Réponse directe

> « La fiabilité de ce projet peut-elle être défendue techniquement ? »

**Avant cet audit : non** — 0 test automatisé dans tout le dépôt, la
seule protection étant des scripts Playwright jetables, écrits puis
supprimés à chaque vérification manuelle. **Après cet audit** : une
suite de 5 tests end-to-end réels existe, tourne dans le CI à chaque
envoi, et couvre les deux écrans les plus complexes du produit (accueil
chauffeur et passager, tout juste découpés en TASK-052 — le moment où
une régression de câblage entre les nouveaux fichiers était la plus
probable). **Ce n'est qu'un début** : la logique la plus critique
(tarification, matching, paiement) vit dans 51 fonctions SQL qui
restent, elles, non testées automatiquement — pas par choix, mais par
une limite réelle de cet environnement (voir §4).

---

## 1. État initial — confirmé, détaillé

**CONFIRMÉ** avant toute action de cet audit :
- 0 fichier `*.test.*`/`*.spec.*` dans tout le dépôt.
- 0 framework de test déclaré dans un `package.json` (`web`, `admin`,
  `mobile`) avant cet audit.
- Vérifications passées reposaient sur des scripts écrits dans le
  scratchpad de session (`playwright-core` + mocks REST/RPC manuels),
  **jamais commités par convention explicite du projet** (« toujours
  nettoyer les scripts de vérification jetables » nommée dans
  `docs/STATUS.md`) — donc perdus à chaque fin de session, aucune
  garantie de non-régression pour le prochain changement.

Ce n'est **pas un manque de rigueur ponctuel** : chaque fonctionnalité
listée dans `docs/CHANGELOG.md` a bien été vérifiée par rendu réel au
moment de sa construction (TASK-030 à TASK-050) — mais aucune de ces
vérifications ne protège contre une régression future, faute d'avoir
été conservée sous une forme rejouable.

---

## 2. Ce qui a été ajouté dans cet audit

**`apps/web/e2e/`** (Playwright officiel, `@playwright/test` en
devDependency) — 5 tests, exécutés réellement dans cet audit avant
d'être committés (voir la trace d'exécution ci-dessous) :

| Test | Ce qu'il protège |
|---|---|
| `driver-home.spec.ts` — dossier en attente | Que `DocumentsSection` reste correctement branchée au hook après tout futur changement |
| `driver-home.spec.ts` — approuvé (abonnement, historique, offre) | Que `SubscriptionSection`/`EarningsSection`/`AvailabilitySection` restent branchées ensemble |
| `driver-home.spec.ts` — course en cours | Que `ActiveRideSection` s'affiche à la bonne condition et masque bien `AvailabilitySection` |
| `passenger-home.spec.ts` — pas de course active | Que `RequestRideSection`/`HistorySection` et la modale de notation cohabitent correctement |
| `passenger-home.spec.ts` — course active | Que `ActiveRideSection` remplace bien le formulaire de demande |

**Exécution réelle** (pas une affirmation) :
```text
Running 5 tests using 2 workers
  ✓ driver-home.spec.ts › dossier en attente : affiche la section Documents
  ✓ driver-home.spec.ts › approuvé : abonnement actif, historique avec facture, offre en attente
  ✓ driver-home.spec.ts › course en cours : remplace la section Disponibilité par Course en cours
  ✓ passenger-home.spec.ts › pas de course active : formulaire de demande + historique + notation en attente
  ✓ passenger-home.spec.ts › course active : affiche le suivi au lieu du formulaire de demande
  5 passed (46.0s)
```
Une vraie erreur d'écriture de test a été trouvée et corrigée pendant
cet audit (locator ambigu `getByText('🚗 Voiture')` qui matchait à la
fois le bouton de catégorie et le badge d'historique — corrigé en
`getByRole('button', ...)`), preuve que la suite exécute réellement le
DOM rendu et ne se contente pas de compiler.

**Intégré au CI** (`.github/workflows/ci.yml`, job `web`) : installe
Chromium (`playwright install --with-deps`) et lance `npm run
test:e2e` après le build — **à chaque envoi sur `main`, désormais**.
Le rapport HTML est conservé 7 jours en cas d'échec.

**Technique** : sert le vrai build de production (`vite preview`), pas
le serveur de développement — les tests exercent exactement les
fichiers qui seraient déployés. Réseau Supabase entièrement simulé
(`page.route`), donc **aucune dépendance à un accès réseau réel** —
ces tests tourneront correctement en CI comme dans n'importe quel
environnement, y compris ceux avec un accès réseau restreint.

---

## 3. Pourquoi pas plus, dans cet audit précis

Le prompt qui définit cet audit demande d'ajouter les tests
**pertinents**, pas d'atteindre une couverture élevée artificiellement.
Deux zones supplémentaires auraient de la valeur mais n'ont **pas** été
ajoutées ici, avec la raison exacte :

- **`apps/admin`** : mêmes écrans candidats (`Users`, `Drivers`,
  `Rides`...), même technique applicable. Non fait dans cette passe
  pour rester concentré sur les écrans qui viennent d'être refactorés
  (risque de régression le plus élevé aujourd'hui) — **recommandation
  P2** : reproduire le même pattern (`e2e/`, `mocks.ts`) sur
  `apps/admin` dans une prochaine tâche dédiée.
- **`apps/mobile`** : la même suite logique existe déjà manuellement
  (`verify-mobile-driver.mjs`/`verify-mobile-passenger.mjs`, TASK-052
  §3), mais `@playwright/test` piloté sur `expo start --web` est plus
  délicat à automatiser en CI (serveur Metro plus lent à démarrer,
  pas encore éprouvé en pipeline) — **recommandation P3**, à
  reconsidérer une fois `apps/mobile` testé sur un vrai appareil
  (Audit 1 §24, bloquant plus prioritaire que l'automatisation de
  cette vérification).

---

## 4. La vraie limite de cet audit — logique SQL non testée automatiquement

**CONFIRMÉ, limite d'environnement, pas un choix** : la majorité de la
logique métier critique (tarification, matching, paiement, facturation,
anti-fraude) vit dans les **51 fonctions `SECURITY DEFINER`** de
Postgres, pas dans le code frontend. Tester cette logique correctement
nécessite un Postgres réel (via `supabase start`, qui orchestre des
conteneurs Docker pour Postgres/Auth/Storage).

**Vérifié dans cet audit** : `docker ps` échoue dans ce sandbox
(`failed to connect to the docker API... daemon is running`) — **aucun
démon Docker actif ici**. `supabase start` est donc **injouable depuis
cet environnement**, quelle que soit la qualité des tests qu'on
voudrait écrire. Tester directement contre le projet Supabase distant
(réel, partagé avec le développement en cours) présenterait un risque
réel de pollution de données — **délibérément écarté** plutôt que
risqué sans votre accord explicite (changement de données de
production, voir `CLAUDE.md` — interdictions absolues).

**Chemin recommandé, prêt à être suivi sur un poste avec Docker** :
1. `supabase start` (stack locale complète) ;
2. `supabase db reset` pour rejouer les 18 migrations locales sur une
   base fraîche — **ce test validerait au passage la réconciliation
   des migrations recommandée en Audit 1 §7.1** ;
3. Écrire des tests **pgTAP** (extension standard PostgreSQL de test
   SQL) ou de simples scripts SQL d'assertion pour les fonctions les
   plus critiques : `estimate_ride_fare` (calcul de tarif),
   `dispatch_next_offer`/`respond_to_ride_offer` (matching), les
   policies RLS déjà vérifiées manuellement en Audit 2/3 (les
   automatiser transformerait une vérification ponctuelle en garde-fou
   permanent).

Non fait dans cet audit : nécessite un environnement que ce sandbox n'a
pas. **Recommandation P1** dès qu'un poste avec Docker est disponible —
c'est la zone de risque la plus importante du projet en termes de
non-régression, plus importante que l'ajout de tests frontend
supplémentaires (§3).

---

## 5. Qualité du code — au-delà des tests

**CONFIRMÉ** (vérifications complémentaires à celles déjà faites dans
les audits précédents, non dupliquées) :

- **0 composant mort** : chaque fichier de `apps/web/src/components/`
  et `apps/admin/src/components/` est référencé ailleurs dans le code
  (vérification systématique par script, pas un sondage) — cohérent
  avec la discipline déjà observée (suppression de `useSession.ts` en
  TASK-052 après une vérification identique).
- **0 `TODO`/`FIXME`/`HACK`** dans tout le code source (Audit 1 §20,
  confirmé de nouveau ici).
- **Complexité des fichiers** : plus aucun fichier > 500 lignes depuis
  TASK-052 (Audit 4 §2) — le fichier le plus long
  (`useDriverDashboard.ts`, 451 lignes) reste une seule responsabilité
  cohérente, pas un fourre-tout.
- **Dépendances** : couverte en détail dans l'Audit 2 §7 (`npm audit`,
  13 vulnérabilités modérées, toutes dans l'outillage Expo, aucune
  runtime) — non reproduite ici.
- **Configurations fragiles** : aucune trouvée dans les fichiers de
  configuration (`vite.config.ts`, `tsconfig*.json`, `playwright.config.ts`)
  — tous type-checkés par `tsc -b` (confirmé, le nouveau
  `tsconfig.node.json` étendu à `e2e/` ne produit aucune erreur).

---

## 6. Scénarios critiques — entrée → traitement → résultat → erreurs

Pour les deux écrans désormais couverts par des tests automatisés,
récapitulatif explicite du contrat vérifié :

### Tableau de bord chauffeur
| Entrée | Traitement | Résultat attendu | Erreur possible | Vérifié |
|---|---|---|---|:-:|
| Dossier chauffeur `pending_review` | Chargement de `driver_documents` | Section Documents avec compteur exact | Table vide → compteur à 0/6 | ✅ (test) |
| Statut `approved` + abonnement actif | Chargement combiné abonnement/historique/offres | 3 sections affichées simultanément, cohérentes entre elles | Une requête vide → section masquée proprement (déjà vérifié manuellement TASK-052) | ✅ (test) |
| Course `in_progress` | `activeRide` non nul | Section Course en cours remplace Disponibilité | `activeRide` et `activeSub` simultanément vrais → priorité à la course (vérifié par l'assertion négative sur "Se mettre indisponible") | ✅ (test) |

### Accueil passager
| Entrée | Traitement | Résultat attendu | Erreur possible | Vérifié |
|---|---|---|---|:-:|
| `activeRide === null` | Formulaire de demande affiché | Sélecteur de catégorie + historique + notation en attente cohabitent | Confusion entre badge et bouton (trouvée et corrigée dans cet audit, §2) | ✅ (test) |
| `activeRide` avec statut annulable | Suivi de course affiché | Bouton Annuler visible, formulaire de demande masqué | Statut non-annulable → bouton masqué (couvert par le code, pas par un test dédié dans cette passe) | ✅ (test, partiel) |

---

## Verdict

**Progrès réel et vérifiable** : le projet passe de 0 à 5 tests
automatisés committés et intégrés au CI dans cet audit — pas seulement
documentés comme manquants. La fiabilité du **frontend des deux écrans
les plus récemment refactorés** peut désormais être défendue
techniquement (une régression de câblage y serait détectée
automatiquement). La fiabilité de **la logique métier SQL** reste, elle,
non automatisée — limite d'environnement documentée en toute
transparence (§4), avec un chemin concret pour la lever.

## Plan de remédiation

- **P1** : tests pgTAP/SQL sur les fonctions critiques, dès qu'un
  environnement avec Docker est disponible (§4).
- **P2** : reproduire `e2e/` sur `apps/admin`.
- **P3** : automatiser la vérification `apps/mobile` en mode web dans
  le CI, une fois le mode manuel (TASK-052) éprouvé plus longtemps.

## Ce que je n'ai pas pu vérifier

- **Tests de charge/concurrence réels** (double soumission
  simultanée, race condition sur `respond_to_ride_offer`) —
  nécessiteraient un environnement de test avec plusieurs clients
  concurrents contre une vraie base, hors périmètre de cet audit
  documentaire.
- **Couverture de code exacte** — aucun outil de couverture configuré ;
  non prioritaire tant que la suite reste aussi ciblée (5 tests sur des
  scénarios choisis, pas une couverture large à mesurer).
