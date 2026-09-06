# Audit 6/12 — Performance et optimisation complète

*Réalisé le 6 septembre 2026. Ne reproduit pas les constats déjà
établis (42 FK sans index, 36 policies RLS `auth_rls_initplan`, absence
de cache, latence de région Supabase — Audits 1 §16 et 4 §4) : cités
par référence. Se concentre sur ce qui n'avait pas encore été
diagnostiqué en profondeur — en particulier la cause racine du
dépassement de taille de bundle signalé à chaque build. Méthode :
mesure réelle (`npm run build` sur les 3 apps), lecture du code
d'assemblage des routes, recherche de motifs N+1 dans les appels
réseau frontend.*

---

## Réponse directe

> « Quels sont les vrais goulots d'étranglement, pas des optimisations
> cosmétiques ? »

Deux trouvailles concrètes, chacune avec une cause racine identifiée
et une correction précise :

1. **`apps/admin` charge les 24 écrans dans un seul fichier JavaScript
   de 743 kB minifié (204 kB gzippé) dès la première visite** — cause
   racine : `router.tsx` importe statiquement les 24 pages au lieu de
   les charger à la demande par route. Un utilisateur qui ne consulte
   que l'écran de connexion télécharge quand même le code des 23
   autres écrans.
2. **`DriverDetail.tsx` (admin) déclenche jusqu'à 6 appels HTTP
   séparés vers l'API Storage** pour générer les URLs signées des
   documents d'un chauffeur, alors que le SDK utilisé
   (`@supabase/storage-js`, confirmé dans le code réellement installé)
   propose une méthode batch (`createSignedUrls`, pluriel) qui ferait
   la même chose en un seul appel.

Ni l'un ni l'autre n'est bloquant à la volumétrie actuelle, mais les
deux sont des corrections simples à fort effet, contrairement à
« ajouter plus de cache » ou « réduire les dépendances » qui seraient
des recommandations génériques ici non justifiées par une mesure.

---

## 1. Frontend — taille de bundle : cause racine identifiée

**CONFIRMÉ, mesuré dans cet audit** :

| App | JS principal (minifié / gzip) | Nombre d'écrans importés statiquement dans `router.tsx` |
|---|---|---:|
| `apps/web` | 556 kB / 157 kB | 6 |
| `apps/admin` | **743 kB / 204 kB** | **24** |

**CONFIRMÉ par lecture du code** : dans les deux apps, `router.tsx`
importe chaque page avec `import { X } from './pages/X'` (import
statique en tête de fichier), pas avec `React.lazy(() =>
import('./pages/X'))`. TanStack Router (déjà utilisé par le projet)
supporte nativement le chargement différé par route
(`component: lazy(...)` ou `.lazy()` sur la définition de route) — ce
n'est pas une dépendance supplémentaire à ajouter, seulement une façon
différente d'importer ce qui existe déjà.

**Impact réel estimé** (INFÉRÉ, pas mesuré précisément dans cet audit —
mesurer le gain exact nécessiterait d'implémenter le changement) :
`apps/admin` a 24 écrans de taille très inégale (`GlobalStats.tsx`,
`Complaints.tsx` à 365 lignes vs des écrans de configuration plus
courts) — passer en chargement par route réduirait le JS initial au
strict nécessaire pour l'écran de connexion + la coquille de
navigation, le reste se chargeant à la navigation. C'est le changement
individuel le plus rentable trouvé dans cet audit pour `apps/admin`.

**Déjà bien fait, à souligner** : les bibliothèques lourdes
(`jsPDF`, `html2canvas`, `dompurify`) sont **déjà** chargées à la
demande via `import()` dynamique (confirmé dans les chunks séparés
`pdf-*.js`, `html2canvas-*.js`, `purify.es-*.js` du build web) — ce
réflexe de code-splitting existe déjà dans le projet, il n'a
simplement pas encore été appliqué au niveau des routes elles-mêmes.

*Recommandation P1 (apps/admin), P2 (apps/web)* : convertir les imports
de page dans `router.tsx` en `React.lazy()`. Changement mécanique,
techniquement réversible, sans risque fonctionnel si fait
correctement (vérifiable immédiatement par `npm run test:e2e`,
maintenant que la suite existe — Audit 5).

---

## 2. Appels réseau — motif N+1 trouvé dans `apps/admin`

**CONFIRMÉ** (`apps/admin/src/pages/DriverDetail.tsx`) :

```ts
for (const doc of row.driver_documents) {
  supabase.storage.from('driver-documents').createSignedUrl(doc.file_path, 300)...
}
```

Un chauffeur a jusqu'à 6 documents (`DOC_TYPES`, voir
`docs/audits/01-audit-production.md` §3) — l'écran de détail chauffeur
déclenche donc **jusqu'à 6 requêtes HTTP parallèles séparées** vers
l'API Storage rien que pour afficher les liens de téléchargement.

**Vérifié dans le SDK réellement installé** (recherche directe dans
`node_modules/@supabase/storage-js/dist/index.mjs`, pas supposée) :
`createSignedUrls` (méthode batch, pluriel) existe et accepte un
tableau de chemins en un seul appel.

*Recommandation P2* :
```ts
const paths = row.driver_documents.map((d) => d.file_path)
const { data } = await supabase.storage.from('driver-documents').createSignedUrls(paths, 300)
```
Remplace jusqu'à 6 requêtes par 1. Gain principalement en latence
perçue (moins de connexions à établir), pas en charge serveur à ce
volume — mais un changement simple, sans risque, à faible coût
d'implémentation.

**Vérifié ailleurs, pas de motif similaire trouvé** : les 3 boucles
`for` détectées dans `apps/admin/src/pages/GlobalStats.tsx`
n'effectuent **aucun appel réseau à l'intérieur de la boucle** — elles
agrègent en mémoire des données déjà chargées en un seul aller-retour
(`Promise.all` de 2 requêtes, puis boucle client-side). C'est le bon
pattern, confirmé correct, pas un N+1.

---

## 3. Base de données — synthèse (renvoi, pas de duplication)

Déjà détaillé et non reproduit ici :
- **42 clés étrangères sans index** (Audit 1 §16) — impact réel
  lorsque le volume de données augmentera, correction simple
  (`CREATE INDEX CONCURRENTLY`).
- **36 policies RLS avec `auth.uid()` réévalué ligne par ligne**
  (Audit 1 §16, connu depuis la première migration).
- **`pg_cron` scanne `ride_offers` en entier toutes les ~10 s**
  (Audit 4 §4.1) — un index `(status, expires_at)` réglerait ce point
  en même temps que les FK manquantes.

---

## 4. Réseau — région Supabase (renvoi)

La latence potentielle liée à l'hébergement du projet Supabase en
`eu-west-1` pour un usage togolais est traitée en détail dans l'Audit 4
§4.2 (finding architectural, pas dupliqué ici). Pertinent pour la
performance perçue mais **non mesurable depuis ce sandbox**.

---

## 5. Images et polices

**CONFIRMÉ** : aucune image statique volumineuse trouvée dans
`apps/web/public`/`apps/admin/public` au-delà des icônes standard —
le produit n'affiche pas de photos (pas de galerie produit, pas
d'avatars uploadés affichés en pleine résolution ailleurs que via URL
signée à la demande). Pas de sujet de poids d'image à traiter ici.
Police : classes Tailwind par défaut (police système), pas de
webfont chargée — aucun coût de chargement de police à optimiser.

---

## 6. Core Web Vitals

**NON VÉRIFIABLE** dans cet audit : mesurer LCP/INP/CLS nécessite un
site réellement chargé dans un vrai navigateur avec un profil réseau
réaliste (Lighthouse/PageSpeed Insights) — aucune URL publique
confirmée à ce jour (Audit 1 §13). *Recommandation* : lancer un audit
Lighthouse dès que `apps/web` est en ligne, en particulier sur la page
de demande de course (carte Google Maps + geolocalisation, poste de
poids le plus probable pour le LCP).

---

## Verdict

**Aucun goulot d'étranglement critique aujourd'hui** (volumétrie de
développement). Les deux trouvailles de cet audit (bundle admin non
découpé par route, appels Storage non groupés) sont de vraies causes
racines, pas des suppositions génériques, et devraient être traitées
**avant que le volume de trafic ne les rende visibles pour de vrais
utilisateurs** plutôt qu'après.

## Plan de remédiation

- **P1** : `React.lazy()` sur les routes de `apps/admin` (743 kB → JS
  initial réduit au strict nécessaire).
- **P2** : idem sur `apps/web` (gain moindre, 6 écrans seulement) ;
  `createSignedUrls` batch dans `DriverDetail.tsx` ; index sur les 42
  FK + `(ride_offers.status, expires_at)` (déjà recommandé Audit 1).
- **P3** : audit Lighthouse une fois en ligne ; mesure de latence
  réseau réelle Togo ↔ `eu-west-1` (Audit 4 §4.2).

## Ce que je n'ai pas pu vérifier

- **Gain réel du lazy loading des routes** — nécessiterait
  d'implémenter le changement et de remesurer ; estimé mais non
  quantifié précisément dans cet audit (documentaire, pas un chantier
  de code — le pipeline n'inclut pas de correction de performance dans
  cette étape, seulement le diagnostic).
- **Core Web Vitals réels** — aucune URL publique disponible.
- **Comportement sous charge réelle** (plusieurs centaines de courses
  simultanées) — non simulable depuis cet environnement.
