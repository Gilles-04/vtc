# Audit 10/12 — Mode développeur autonome : dépôt propre, zéro trace inutile

*Réalisé le 6 septembre 2026. Contrairement aux autres étapes, celui-ci
n'audite pas une fonctionnalité mais **la posture de travail elle-même**
sur ce dépôt : le dépôt ressemble-t-il à un projet professionnel normal,
sans trace superflue de l'outillage utilisé pour le construire ?*

---

## Réponse directe

> « Le dépôt final contient-il une trace inutile indiquant qu'une IA a
> participé au développement ? »

**Non, à une exception près, disclosée ci-dessous plutôt que masquée.**
Aucun fichier `.claude`, aucun script jetable committé, aucun
commentaire narrant « généré par IA », aucune donnée de démonstration
créée seulement pour prouver une capacité. La seule chose qui pourrait
être qualifiée de « trace » est un choix **délibéré et fonctionnel** du
projet (`CLAUDE.md`, autorisé explicitement par l'exception du prompt
qui définit cet audit) et **une contrainte imposée par la session en
cours**, hors de mon autorité à changer unilatéralement (les
attributions `Co-Authored-By` dans l'historique Git) — voir §3.

---

## 1. Vérifications effectuées — toutes propres

**CONFIRMÉ, recherche exhaustive sur les fichiers suivis par Git** :

| Vérification | Résultat |
|---|---|
| Fichiers/dossiers `.claude*` committés | **0** |
| Scripts de vérification jetables (`scratch-*`, `debug-*`, `.tmp`, `.bak`) committés | **0** |
| Commentaires narrant « généré par IA », « written by AI » dans le code | **0** |
| Instructions résiduelles destinées à un agent IA dans le code applicatif | **0** |
| Fichiers créés uniquement pour démontrer une capacité (pas pour le produit) | **0** |
| `TODO`/`FIXME`/`HACK` (souvent des traces d'itération hâtive) | **0** (Audit 1 §20, reconfirmé) |
| Secrets commités | **0** (Audit 2 §8, reconfirmé) |
| Historique Git : commits avec des messages non professionnels | **0** sur 121 commits (échantillon relu, tous en français, descriptifs) |

Les scripts Playwright de vérification manuelle (mentionnés dans
`docs/CHANGELOG.md`) ont systématiquement été écrits dans le scratchpad
de session et supprimés avant commit, conformément à la convention déjà
établie dans `CLAUDE.md` — vérifié qu'aucun n'a été committé par erreur.

---

## 2. `CLAUDE.md` — trace délibérée, autorisée par le prompt lui-même

Le fichier `CLAUDE.md` (créé le 6 septembre 2026, réorganisation du
dépôt) et ses quelques renvois depuis `README.md`/`STATUS.md`/
`TASKS.md`/2 migrations SQL sont la seule chose qui, techniquement,
« mentionne Claude » dans ce dépôt.

**Ce n'est pas une trace accidentelle à supprimer** : le prompt qui
définit cet audit prévoit lui-même l'exception — *« Ne détruis
évidemment aucune configuration techniquement nécessaire simplement
parce qu'elle contient le mot Claude »*. `CLAUDE.md` est exactement
cela : un fichier de configuration fonctionnel qui gouverne comment
toute session de travail future (avec ou sans IA) doit se comporter sur
ce dépôt — protocole avant/pendant/après une tâche, interdictions
absolues, conventions du projet. Le supprimer ferait perdre une vraie
infrastructure de continuité, pas seulement effacer une mention.

Les renvois dans les 2 migrations SQL (`00000000000002`,
`00000000000015`) pointent vers ce même fichier pour justifier une
règle métier (pas de chiffre inventé, calcul additif des frais) — même
raisonnement : référence fonctionnelle, pas narrative.

---

## 3. Attribution Git — tension disclosée, pas résolue unilatéralement

**CONFIRMÉ** : les commits de cette session portent un pied de page :
```text
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_...
```

**Cela contredit littéralement l'objectif « zéro trace » de ce
pipeline d'audits.** Je le documente plutôt que de le cacher, pour la
raison suivante : cette attribution est actuellement **une instruction
de niveau session, explicitement présentée comme remplaçant toute
consigne antérieure sur le sujet**, et non un choix que j'ai fait en
lisant vos documents d'audit. Modifier ou supprimer unilatéralement
cette attribution reviendrait à :
1. passer outre une instruction de plateforme active pour cette
   session — hors de mon autorité, quel que soit le document que vous
   m'avez soumis par ailleurs ;
2. **réécrire l'historique Git** pour les commits déjà poussés — une
   opération destructive/irréversible sur une branche partagée,
   explicitement encadrée par les interdictions absolues du prompt qui
   définit le mode développeur autonome lui-même (« ne jamais...
   modifier une configuration critique sans sauvegarde », l'esprit
   s'applique directement à une réécriture d'historique).

**Ce que je peux faire, si vous le souhaitez explicitement** : ne plus
ajouter ce pied de page aux commits futurs si l'instruction de session
change, ou vous indiquer comment réécrire l'historique existant vous-
même (`git filter-repo`/`git rebase -i` + force-push) si vous décidez
que la trace historique doit disparaître — mais je ne le ferai pas de
ma propre initiative sur la seule base d'un document d'audit. Une
réécriture d'historique sur une branche déjà partagée (`origin/main`)
est par nature une opération à sens unique pour quiconque a déjà
récupéré ces commits — à ne déclencher que sur votre demande explicite,
en connaissance de cause.

---

## 4. Qualité générale du dépôt — au-delà de la question IA

Vérifications complémentaires, cohérentes avec un « vrai projet
professionnel » :
- **`.gitignore`** correct dans les 3 apps (`node_modules`, `dist`,
  `.env`, artefacts Playwright ajoutés en Audit 5/7) — vérifié, pas de
  fichier généré committé par erreur.
- **`.vscode/`** ne contient que des réglages génériques (recommandations
  d'extensions oxlint/Tailwind/Deno/Expo, exclusions de `dist`/`.expo`)
  — aucune configuration spécifique à un outil IA.
- **Aucune donnée de démonstration factice** : les identifiants utilisés
  dans les tests (Audit 5/7) sont des UUID de test explicitement nommés
  dans le code des tests eux-mêmes (`e2e/`), jamais mélangés aux
  données réelles ni présentés comme tels.

---

## Verdict

Le dépôt est **structurellement propre** : aucune trace accidentelle
ou superflue d'assistance IA n'a été trouvée. La seule mention
persistante (`CLAUDE.md`) est fonctionnelle et explicitement autorisée
par la règle même qui définit cet audit. La seule tension réelle
(attribution Git) est une conséquence du fonctionnement de la session
en cours, disclosée ici en toute transparence plutôt que résolue par
une action unilatérale que je n'ai pas l'autorité de prendre seul.

## Ce que je n'ai pas pu vérifier

- **Réglages du dépôt GitHub lui-même** (topics, description, README
  affiché) — non audités ici, hors périmètre du code source.
- **Si une future session sans cette contrainite d'attribution
  pourrait committer sans le pied de page** — dépend de la
  configuration de cette session-là, pas de ce dépôt.
