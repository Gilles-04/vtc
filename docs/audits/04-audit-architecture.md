# Audit 4/12 — Architecture, scalabilité et maintenabilité

*Réalisé le 6 septembre 2026. Ne reproduit pas les constats déjà
établis dans les audits 1-3 (migrations désynchronisées, RLS,
`search_path`, index manquants) — ils sont cités par référence quand
pertinents pour l'architecture. Méthode : lecture du monorepo, des
schémas SQL, des `package.json`, vérification directe (grep) de
l'absence de couplage entre apps.*

---

## Réponse directe

> « Cette architecture tient-elle la route pour grandir, et où sont
> les vrais points de fragilité ? »

L'architecture est **délibérément simple et cohérente avec la taille
du projet** : pas de sur-ingénierie (pas de microservices, pas de
backend custom en plus de Supabase), séparation propre en 3 apps
indépendantes sans couplage croisé, monorepo npm workspaces sain
(0 fichier > 500 lignes depuis TASK-052). Le vrai point de fragilité
n'est **pas** le code applicatif mais **une décision d'infrastructure
prise implicitement et jamais documentée explicitement** : le projet
Supabase est hébergé en **région `eu-west-1` (Irlande)** pour un
service destiné à des utilisateurs au Togo — un aller-retour réseau
supplémentaire d'environ 150-200 ms sur chaque requête, potentiellement
significatif pour un produit qui dépend du temps réel (matching,
position GPS toutes les 15-20 s).

---

## 1. Vue d'ensemble architecturale

```text
apps/web ─┐
apps/admin ├─→ Supabase Cloud (eu-west-1) ←─ apps/mobile
           │      (seul backend, aucun serveur applicatif custom)
           └─ 0 import croisé entre apps (vérifié par grep, confirmé)
```

- **Aucun couplage direct entre les 3 apps** : recherche exhaustive
  d'imports relatifs traversant les frontières d'app (`../../../apps/`)
  — **zéro résultat**. Chaque app est un artefact indépendant, seul le
  contrat implicite (schéma de base, conventions RPC) les relie.
- **Pas de couche applicative intermédiaire** : le choix « toute la
  logique métier vit dans Postgres (fonctions `SECURITY DEFINER`) »
  élimine une classe entière de bugs de synchronisation
  frontend/backend (pas de DTO à maintenir en double), au prix d'une
  dépendance totale à Postgres/PL-pgSQL pour toute évolution de logique
  — compromis assumé et documenté (`docs/02-architecture-technique.md`).

---

## 2. Séparation des responsabilités et modularité

**CONFIRMÉ** : depuis TASK-052 (6 septembre 2026), plus aucun fichier
de code ne dépasse 500 lignes. Le pattern retenu (hook `use*Dashboard`
pour la donnée, un fichier par bloc d'affichage, un fichier
d'assemblage) est **appliqué de façon identique sur les 4 écrans
concernés** (web ×2, mobile ×2) — cohérence de convention vérifiée, pas
seulement appliquée une fois puis abandonnée.

Le plus long fichier restant (`useDriverDashboard.ts`, 451 lignes,
web) reste une **seule responsabilité cohérente** (toute la
donnée/mutations d'un écran) — documenté comme dépassement volontaire
et justifié dans `docs/CHANGELOG.md` TASK-052, conformément à la règle
« un dépassement reste possible s'il est justifié, documente
brièvement la raison ».

---

## 3. Duplication de code — décision déjà prise, réévaluée ici

**CONFIRMÉ** (`docs/DECISIONS.md`) : `apps/web` et `apps/mobile`
dupliquent volontairement 8 composants et l'essentiel de `lib/types.ts`
plutôt que de les partager via un package commun (`packages/`,
supprimé le 6 septembre 2026 — jamais peuplé, TASK-094).

**Réévaluation de cette décision dans le contexte de cet audit** :
- Le risque documenté (« un champ mis à jour d'un côté, oublié de
  l'autre ») **reste valable et n'a pas de garde-fou automatisé** —
  aucun test ne compare `apps/web/src/lib/types.ts` et
  `apps/mobile/src/lib/types.ts`. Un changement de schéma DB oublié
  d'un côté ne serait détecté qu'au runtime (erreur PostgREST), pas au
  build (les deux fichiers de types sont indépendants, `tsc` ne peut
  pas croiser les deux apps).
- **Toujours un compromis raisonnable** à l'échelle actuelle (2
  plateformes, une seule personne qui maintient le code) — je ne
  recommande pas de le défaire maintenant, mais je documente le
  garde-fou manquant : *recommandation P3*, ajouter un script (CI ou
  local) qui diffe les deux `types.ts` et échoue si une table/colonne
  diverge au-delà des différences déjà connues et volontaires.

---

## 4. Scalabilité — ce qui tiendra, ce qui ne tiendra pas

### 4.1 Matching : dette technique documentée, avec un vrai plan

**CONFIRMÉ** : `services/matching-worker` (vraie boucle applicative,
gestion d'erreurs/redémarrage) est écrit et testé en local mais **jamais
déployé** faute de VPS dédié à ce projet. Remplacé par un balayage
`pg_cron` toutes les ~10 secondes (migration 17) — solution interimaire
explicitement documentée comme telle, pas présentée comme définitive.

**Analyse de cet audit** : `pg_cron` à 10 s d'intervalle scanne
**toute la table `ride_offers`** à chaque exécution pour trouver les
offres expirées. À la volumétrie actuelle (quelques lignes), coût
négligeable. **Point de bascule réel** : au-delà de quelques milliers
d'offres actives simultanées, un scan complet toutes les 10 s devient
mesurable — mais un index sur `(status, expires_at)` (à vérifier/ajouter
lors de la correction des index manquants, Audit 1 §16) repousserait
largement ce seuil. **Pas un problème aujourd'hui, à surveiller** une
fois un vrai volume de courses simultanées.

### 4.2 Région Supabase et latence géographique — finding nouveau

**CONFIRMÉ, non documenté ailleurs dans le projet avant cet audit** :
le projet Supabase (`elrsjctwrvzglwogmmpq`) est hébergé en
**`eu-west-1` (Irlande)**. Le marché cible est **Lomé, Togo**
(`docs/01-architecture-fonctionnelle.md`).

- Distance réseau approximative Lomé ↔ Irlande : ~5000 km. Latence
  aller-retour typique pour ce trajet sur l'infrastructure internet
  actuelle : **de l'ordre de 150-250 ms selon les opérateurs locaux**
  (**INFÉRÉ à partir de la géographie réseau générale, pas mesuré
  directement — aucun accès à un point de test au Togo depuis ce
  sandbox : NON VÉRIFIABLE précisément sans un test réel depuis
  là-bas**).
- Impact réel pour ce produit : chaque appel RPC (estimation de prix,
  réponse à une offre, mise à jour de position) porte ce coût fixe en
  plus du temps de traitement Postgres lui-même. Pour une fenêtre
  d'acceptation d'offre chauffeur généralement courte (quelques
  secondes dans ce type d'app), 150-250 ms de latence réseau
  représentent une part non négligeable du budget de réactivité perçu.
- **Ce n'est pas nécessairement une erreur** : Supabase ne propose pas
  de région en Afrique de l'Ouest à ce jour (`eu-west-1` est
  généralement la région la plus proche disponible). C'est une
  **contrainte du fournisseur**, pas un choix arbitraire à corriger
  facilement — mais elle mérite d'être **mesurée réellement** avant le
  lancement plutôt que découverte après.
- *Recommandation P2* : une fois l'app déployée, mesurer la latence
  réelle RPC depuis un réseau mobile togolais (test manuel simple :
  chronométrer `estimateFare`/`respondToOffer` depuis un téléphone à
  Lomé). Si le résultat est problématique, les options réalistes sont
  limitées (pas de région Supabase plus proche) — au mieux, optimiser
  le nombre d'aller-retours réseau par action utilisateur.

### 4.3 Absence de cache

**CONFIRMÉ** : aucune couche de cache (Redis, cache HTTP, `staleTime`
de bibliothèque de fetching) — chaque écran interroge Supabase
directement à chaque montage/realtime event. Raisonnable à la
volumétrie actuelle. Le premier écran qui en souffrirait
probablement : `admin_stats_overview` (agrégations), déjà identifié
comme candidat à surveiller côté performance (renvoyé à l'audit
pipeline étape 6, pas traité ici pour éviter la duplication).

### 4.4 Realtime — modèle par canal utilisateur

**CONFIRMÉ** : chaque session ouvre un canal Supabase Realtime dédié
(`driver-${id}`, `passenger-${id}`) filtré côté serveur par
`postgres_changes`. Ce modèle scale linéairement avec le nombre
d'utilisateurs connectés simultanément — c'est le modèle standard
Supabase, pas une anomalie du projet. Les limites de connexions
Realtime concurrentes dépendent du plan Supabase souscrit — **NON
VÉRIFIABLE** depuis cet audit (nécessite le Dashboard → Billing).

---

## 5. Point unique de défaillance (SPOF)

**CONFIRMÉ** : Supabase Cloud est l'unique dépendance d'infrastructure
du produit (Auth + DB + Storage + Realtime + Edge Functions). Un
incident Supabase indisponibilise l'intégralité des 3 apps
simultanément — **compromis assumé et cohérent** avec le choix
« backend-as-a-service » pour une équipe d'une personne ; l'alternative
(auto-héberger une partie du backend) ajouterait une complexité
opérationnelle disproportionnée à ce stade. Pas de recommandation de
changement ici — seulement le signalement explicite du SPOF, pour que
la décision reste consciente (traité plus en détail dans l'audit
pipeline étape 9, sauvegardes/disaster recovery).

Second SPOF, plus discret : `pg_cron` (§4.1) est un mécanisme
interimaire sans détection de panne — si le job s'arrête silencieusement,
rien ne l'alerte aujourd'hui (aucun monitoring en place, confirmé Audit
1 §22). *Renvoyé à l'audit pipeline étape 9.*

---

## 6. Extensibilité

- **Catégories de véhicule** (`driver_category`, enum Postgres
  `'car' | 'moto'`) : ajouter une troisième catégorie (ex. tricycle,
  courant en Afrique de l'Ouest) nécessite une migration
  `ALTER TYPE ... ADD VALUE` — non bloquante, non destructive, mais
  **touche une quinzaine de points du code** (`CategoryBadge`, filtres
  admin, règles de tarification `pricing_rules.category`) — coût de
  changement modéré, pas trivial. À anticiper si une extension de
  l'offre est envisagée.
- **Zones géographiques** (`zones` table) : déjà conçu pour être
  multi-ville dès le départ (`city` sur `zones`, `drivers`) — extension
  vers une deuxième ville togolaise après Lomé **ne nécessite aucun
  changement de schéma**, seulement de la configuration (nouvelles
  zones, nouvelles règles de tarification). Bon point d'extensibilité
  déjà pensé.
- **Promotions/parrainage** : scaffolding SQL présent, non branché à
  aucun écran (décision volontaire documentée, voir Audit 1 §3) —
  extensible sans migration de schéma le jour où la fonctionnalité est
  priorisée.

---

## 7. Dépendances et dette liée aux versions

**CONFIRMÉ** (lecture des `package.json`) : React 19.2, Vite 8,
TypeScript 6, Expo SDK 57, React Native 0.86 — **versions très
récentes** (React 19 et Vite 8 sont sortis récemment). C'est cohérent
avec un projet démarré en 2026, mais **maintient un risque
d'écosystème** : certaines bibliothèques tierces mettent du temps à
suivre les versions majeures de React — non problématique aujourd'hui
(aucune incompatibilité trouvée, `npm run verify` propre), mais à
surveiller à chaque mise à jour de dépendance.

`apps/mobile` fait partie des workspaces npm (`apps/*`) sans lockfile
séparé — fonctionne correctement dans cet environnement (vérifié :
`expo start --web` a démarré sans erreur de résolution de module lors
de TASK-052), mais c'est un choix un peu moins standard que
d'isoler un projet Expo de ses voisins web (Metro a parfois des
attentes différentes de Vite sur la résolution de modules) —
**observation, pas un problème constaté**.

---

## 8. Dette technique — synthèse (hors doublons avec audits 1-3)

| Élément | Impact actuel | Impact à l'échelle | Priorité |
|---|---|---|---|
| `pg_cron` au lieu du vrai `matching-worker` | Nul | Modéré (scan complet périodique) | P2 (index déjà recommandé Audit 1) |
| Région Supabase distante du marché cible | Non mesuré | Potentiellement significatif sur le temps réel | P2 — mesurer avant de juger |
| Pas de cache | Nul | Modéré sur les écrans d'agrégation | P3 |
| Types dupliqués web/mobile sans garde-fou automatisé | Nul | Risque de divergence silencieuse | P3 |
| Extension de catégorie = migration + ~15 points de code | N/A | Coût de changement modéré, pas bloquant | Info |

---

## Verdict

**Architecture saine pour la taille et le stade actuels du projet.**
Aucun problème structurel critique trouvé. Le point le plus important
de cet audit — la latence géographique potentielle — n'est **pas un
défaut de conception** mais une **contrainte de plateforme non encore
mesurée** : à vérifier concrètement dès que le produit sera accessible
depuis le Togo, plutôt que supposée bonne ou mauvaise sans données.

## Ce que je n'ai pas pu vérifier

- **Latence réseau réelle Togo ↔ `eu-west-1`** — nécessite un test
  depuis un réseau togolais réel, impossible depuis ce sandbox.
- **Limites de connexions Realtime/plan Supabase actif** — nécessite le
  Dashboard → Billing.
- **Comportement de `pg_cron` à un volume de courses réellement élevé**
  — nécessiterait un test de charge, non mené dans cet audit
  (documentaire, pas un test de performance — voir pipeline étape 6).
