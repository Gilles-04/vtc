# Audit 12/12 — Dossier documentaire complet et vivant du projet

*Réalisé le 6 septembre 2026. Contrairement aux 11 audits précédents,
celui-ci n'audite pas une fonctionnalité technique mais **le dossier
`docs/` lui-même** : est-il complet, cohérent, à jour, et facile à
suivre pour quelqu'un qui n'a pas écrit le code ? Méthode : inventaire
exhaustif de `docs/`, vérification des dates de dernière modification de
chaque document via `git log`, et correction des lacunes identifiées qui
étaient sûres et peu coûteuses (contrairement aux audits 1-11, celui-ci
est explicitly une **création**, pas seulement un diagnostic).*

---

## Réponse directe

> « Ce projet a-t-il une documentation complète et vivante, ou fige-t-il
> un état passé qui ne reflète plus la réalité ? »

**Le contenu est réel et sérieux, mais il était mal relié et manquait
un point d'entrée pour un lecteur non technique — les deux corrigés
dans cet audit.** Ce projet a déjà, avant cet audit, une documentation
largement supérieure à la moyenne pour ce stade : 12 livrables de
cadrage écrits en amont du code, une architecture « instantané vs
historique » déjà en place (`STATUS.md`/`TASKS.md` réécrits à chaque
étape, `CHANGELOG.md`/`DECISIONS.md` qui ne s'effacent jamais), et
désormais 12 audits indépendants avec preuves. **Le vrai défaut trouvé
n'était pas un manque de contenu, mais un manque de liaison** : le
dossier `docs/audits/` (11 fichiers avant celui-ci) n'était référencé
nulle part depuis le README racine — un lecteur arrivant sur le dépôt
n'aurait eu aucune indication que ce travail existe.

---

## 1. Inventaire — ce qui existait déjà, confirmé complet et cohérent

**CONFIRMÉ, lecture exhaustive de `docs/`** :

| Catégorie | Contenu | État |
|---|---|---|
| Livrables de cadrage (design amont) | 12 fichiers numérotés (`01`-`12`), architecture/écrans/BDD/API/matching/abonnement/paiements/sécurité/roadmap | Complets, écrits avant le code, cohérents avec la structure réelle du produit (spot-check §2) |
| Suivi de projet (vivant) | `STATUS.md` (instantané), `TASKS.md` (tâches ouvertes), `CHANGELOG.md` (historique daté, jamais élagué), `DECISIONS.md` | À jour — mis à jour à chaque tâche significative, confirmé par `git log` (dernières mises à jour le 6 sept. 2026, en continu depuis le début du projet) |
| Audits (nouveau, cette session) | 11 audits indépendants avant celui-ci, `00-pipeline.md` en tracker | Complets, chacun avec verdict + preuves + plan de remédiation |
| READMEs par app | `apps/web/README.md`, `apps/admin/README.md`, `apps/mobile/README.md` | Existent, référencés depuis le README racine |
| Règles permanentes | `CLAUDE.md` (protocole de travail, conventions, règles qui ont mordu) | Existe, référencé depuis le README racine |

**Rien de tout cela n'a été trouvé obsolète ou contradictoire** — à la
différence de ce qui avait motivé la réorganisation du 6 septembre 2026
(voir `docs/DECISIONS.md`), aucune section de `STATUS.md` ne se
contredit, aucune information n'est dupliquée entre `STATUS.md` et
`CHANGELOG.md`.

---

## 2. Vérification de fraîcheur — les livrables de cadrage sont des plans, pas un journal, et c'est voulu

**CONFIRMÉ** : les 12 livrables de cadrage (`01` à `12`) ont tous leur
dernière modification datée du 3 ou 4 septembre 2026, alors que des
fonctionnalités substantielles ont été construites après cette date
(SOS, signalement, notifications in-app, notation post-course, support
client, empreinte d'appareil anti-fraude, carte live admin — commits du
5 septembre 2026). **Ce n'est pas une négligence documentaire** :
vérification faite, chacune de ces fonctionnalités était **déjà
prévue** dans les livrables de cadrage avant sa construction (ex.
`05-ecrans.md` liste déjà l'écran Notation, Signalement, SOS, Carte
live, Support avant leur construction) — les livrables décrivent
l'intention de conception, un rôle qu'ils remplissent toujours
correctement, tandis que `STATUS.md`/`TASKS.md`/`CHANGELOG.md` sont la
couche qui suit l'avancement réel. Les commits « Documente TASK-04X »
du 5 septembre (vérifiés un par un) modifient uniquement ces deux
derniers fichiers, jamais les livrables de cadrage — cohérent avec
cette répartition des rôles, pas un oubli.

**Un point mérite d'être signalé sans être un défaut** : deux livrables
(`11-securite.md`, `12-roadmap.md`) contiennent une référence explicite
à « MBONPLAN », l'autre projet du porteur de ce dépôt, pour justifier la
réutilisation d'un principe déjà éprouvé ailleurs (bucket de documents
privé signé, webhook de supervision, règle « jamais de vérification
seulement théorique »). **Vérifié comme intentionnel et antérieur à
cette session** — ce n'est pas une contamination croisée à corriger,
juste une note de provenance légitime laissée par une session
précédente.

---

## 3. Lacune trouvée et corrigée : le dossier `docs/audits/` était invisible depuis le point d'entrée du dépôt

**CONFIRMÉ avant correction** : le README racine listait les 12
livrables de cadrage et les 4 fichiers de suivi, mais **aucune mention
de `docs/audits/`** — ni dans le sommaire, ni dans la structure du
dépôt. Un onze audits (bientôt douze), avec la trouvaille la plus
critique de tout le projet à ce jour (Audit 9 : aucune sauvegarde,
plan Supabase Free), n'étaient accessibles qu'à quelqu'un qui savait
déjà que ce dossier existait.

**Corrigé dans cet audit** :
- Ajout d'une section « Audits » au README racine, avec lien direct
  vers `docs/audits/00-pipeline.md` et rappel explicite de la trouvaille
  Audit 9 (sauvegardes).
- Ajout de `docs/audits/` dans le schéma de structure du dépôt du
  README.
- Ajout d'un renvoi croisé dans `docs/11-securite.md` (règles conçues)
  vers `docs/audits/02` et `03` (vérification réelle de ces règles).
- Ajout d'un renvoi croisé dans `docs/12-roadmap.md` (plan) vers
  `docs/audits/00-pipeline.md` (ce qui bloque réellement avant un vrai
  lancement).

---

## 4. Lacune trouvée et corrigée : aucun glossaire pour un lecteur non technique

**CONSTAT** : le dossier `docs/` (livrables + audits) emploie
régulièrement des termes techniques sans les expliquer (RLS, KYC, RPC,
`SECURITY DEFINER`, PITR, SPOF, WCAG, OWASP, JWT, SPA, N+1, Open
Graph...) — cohérent pour un dossier technique, mais un obstacle réel
pour le porteur du projet, explicitement non développeur, qui doit
pourtant lire ce dossier pour prendre des décisions (ex. TASK-054 :
comprendre ce qu'est PITR pour arbitrer le passage au plan Pro).

**Corrigé dans cet audit** : création de
[`docs/13-glossaire.md`](../13-glossaire.md), organisé par thème
(produit, technique général, Supabase/BDD, sécurité, performance/
accessibilité, référencement, déploiement), chaque entrée pointant vers
le document où le sujet est traité en détail — ajouté au sommaire du
README racine comme 13ᵉ livrable.

---

## 5. Ce qui n'a pas été ajouté, et pourquoi

Le prompt qui définit cet audit envisage une structure documentaire
pouvant aller jusqu'à ~32 fichiers thématiques. **Ce projet n'a pas
besoin d'une telle volumétrie** : ses 13 livrables de cadrage + 4
fichiers de suivi + 12 audits couvrent déjà, en substance, l'ensemble
des sujets qu'une structure plus longue viserait à isoler (architecture,
sécurité, tests, performance, déploiement, décisions, glossaire...).
Créer 20 fichiers supplémentaires pour respecter un gabarit générique
aurait **dupliqué du contenu déjà écrit** ailleurs et rendu le dossier
plus difficile à naviguer, pas plus « vivant » — à l'exact opposé de la
règle déjà établie sur ce projet (`CLAUDE.md` : ne jamais empiler,
réécrire à sa place). Cohérent avec le principe déjà appliqué dans les
audits 1-11 : adapter le périmètre à la réalité du projet plutôt que
remplir mécaniquement un gabarit générique.

---

## Verdict

🟢 **Dossier documentaire sain, maintenant relié et accessible à un
lecteur non technique.** Le contenu de fond était déjà solide avant cet
audit (12 livrables cohérents, suivi de projet réellement vivant,
11 audits déjà terminés) ; les deux vraies lacunes trouvées
— l'invisibilité du dossier d'audits depuis le point d'entrée du dépôt,
et l'absence de glossaire — étaient toutes deux peu coûteuses à corriger
et l'ont été dans cet audit même, plutôt que reportées à une tâche
future.

## Ce que je n'ai pas pu vérifier

- **Si le porteur du projet trouve effectivement le glossaire et les
  nouveaux liens utiles en pratique** — jugement d'usage, pas quelque
  chose qu'une lecture de code peut confirmer.
- **La discipline de mise à jour de `docs/13-glossaire.md` dans le
  futur** (nouveau terme technique introduit sans être ajouté au
  glossaire) — dépend des sessions futures, pas de l'état actuel.
