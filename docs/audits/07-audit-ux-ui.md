# Audit 7/12 — UX/UI, accessibilité et expérience utilisateur

*Réalisé le 6 septembre 2026. Comme l'audit 5 (tests), celui-ci ne se
limite pas à un constat : un scan d'accessibilité automatisé réel
(axe-core, règles WCAG 2.0/2.1 A+AA) a été ajouté, exécuté, une vraie
violation trouvée et corrigée, la correction revérifiée sans
régression. Méthode : scan automatisé sur les deux écrans déjà couverts
par des tests (Audit 5), vérifications statiques complémentaires sur le
reste du code (labels, alt, éléments cliquables non sémantiques).*

---

## Réponse directe

> « Le produit est-il utilisable et accessible, pas seulement joli ? »

**Un vrai défaut a été trouvé et corrigé dans cet audit**, pas
seulement documenté : le badge de statut « en attente » (couleur
« gold »), utilisé pour au moins 9 statuts différents à travers les 3
apps (`pending_review`, `searching`, `pending`, `open`, `processing`,
`driver_subscription`, `acknowledged`, priorité `medium`...), avait un
contraste de texte de **2,96:1** — en dessous du minimum WCAG AA
(4,5:1) pour du texte de cette taille. **Corrigé dans les 3 apps**
(nouvelle teinte `gold-700`/`gold700`, mesurée à 4,81-4,83:1). En
dehors de ce point, la structure du code (pas d'`<img>` sans texte
alternatif, pas d'élément cliquable non sémantique, labels de
formulaire majoritairement bien associés) est saine.

---

## 1. Ce qui a été ajouté et corrigé dans cet audit

**`apps/web/e2e/accessibility.spec.ts`** (nouveau, committé) : scan
`axe-core` (via `@axe-core/playwright`) sur `DriverHome` (dossier en
attente) et `PassengerHome` (formulaire de demande), règles
`wcag2a`+`wcag2aa`. Exécuté réellement dans cet audit :

- **Avant correction** : 1 violation trouvée sur `DriverHome`
  (`color-contrast`, sévérité `serious`) — badge « En attente de
  revue » (2,96:1 au lieu de 4,5:1 requis). 0 violation sur
  `PassengerHome`.
- **Correction appliquée** : nouvelle couleur `gold-700`/`gold700`
  (`#8f6300`) réservée aux badges de texte, ajoutée à côté de
  `gold-600` (conservée pour les usages non textuels et le grand texte
  gras qui, eux, passent déjà — `StatCard` admin vérifié à 3,25:1 sur
  fond blanc, suffisant pour du texte 24 px gras qui ne requiert que
  3:1). Appliquée de façon identique dans **les 3 apps** (même bug
  dupliqué dans `apps/web`, `apps/admin`, `apps/mobile` — même palette
  copiée dans les trois, voir `docs/DECISIONS.md`).
- **Après correction, revérifié réellement** : 0 violation sur les
  deux pages, `npm run test:e2e` (7 tests, dont les 5 de l'Audit 5) au
  vert.

Ce n'était pas visible à l'œil sur un écran bien réglé — c'est
précisément le genre de défaut qu'un outil automatisé détecte et qu'une
relecture visuelle manque facilement.

---

## 2. Vérifications statiques complémentaires (au-delà du scan)

Le scan `axe-core` ne couvre que 2 écrans sur toute la surface du
produit (24 écrans admin, plusieurs écrans web/mobile). Vérifications
manuelles complémentaires sur le reste du code :

- **Images** : **0 balise `<img>`** dans `apps/web`/`apps/admin`
  (recherche exhaustive) — le produit n'affiche pas de photos en dur
  dans le code (cohérent avec l'Audit 6 §5). Aucun risque de texte
  alternatif manquant à ce niveau.
- **Éléments cliquables non sémantiques** : **0 `<div>`/`<span>` avec
  `onClick`** trouvé dans les deux apps — toutes les zones cliquables
  passent par `<button>` (nativement accessible au clavier et aux
  lecteurs d'écran) ou par `<a>`/composants de navigation. C'est le
  piège classique en React (un `<div onClick>` sans `role="button"` ni
  `tabIndex` devient invisible au clavier) — **absent ici, vérifié, pas
  supposé**.
- **Association label/champ** : sur 32 `<input>` trouvés dans le code,
  27 ont un `<label>` immédiatement associé dans le code source
  (vérification heuristique par proximité textuelle, pas un parseur
  AST — à considérer comme un sondage solide, pas une preuve
  exhaustive). Le pattern dominant (`<label>texte<input .../></label>`,
  vu dans `DocumentsSection.tsx`) est le bon pattern HTML natif
  (association implicite, fonctionne avec tous les lecteurs d'écran).

---

## 3. Ce qui reste à vérifier hors de cet environnement

**NON VÉRIFIABLE depuis ce sandbox** :
- **Navigation clavier réelle** (ordre de tabulation, piège de focus
  dans les modales `ReportModal`/`ProfileModal`/`RatingModal`) — un
  scan automatisé `axe-core` détecte des défauts structurels, pas
  l'expérience réelle de navigation au clavier de bout en bout ; à
  tester manuellement (Tab/Shift+Tab/Échap) une fois le site en ligne.
- **Contraste et lisibilité sur un vrai écran de téléphone** en plein
  soleil (contexte d'usage réaliste pour un chauffeur togolais) — un
  calcul de contraste WCAG ne remplace pas un test visuel réel en
  extérieur.
- **`apps/mobile` sur un vrai appareil** — déjà documenté comme
  bloquant plus large (Audit 1 §24) ; aucun rendu natif réel vérifié à
  ce jour, accessibilité incluse (VoiceOver/TalkBack jamais testés).
- **Responsive réel** (au-delà des classes Tailwind présentes dans le
  code) — nécessiterait un test sur plusieurs tailles d'écran réelles,
  pas seulement une lecture du code.

---

## 4. Expérience utilisateur — observations de code (sans duplication)

Déjà couvert ailleurs, non reproduit :
- États loading/vide/erreur présents sur les écrans audités (Audit 1
  §5).
- `Alert.alert` no-op en mode web mobile — limite de vérification
  documentée (Audit 1 §4, §24).

Nouveau dans cet audit :
- **Messages d'erreur RPC traduits en français compréhensible**
  (`pricingErrorMessage`, `no_active_subscription` → phrase complète)
  plutôt que le code d'erreur brut — bonne pratique déjà en place,
  vérifiée sur les chemins d'erreur les plus courants (abonnement,
  estimation de tarif).
- **Confirmation avant action destructive** : annulation de course
  (web : `window.confirm`, mobile : `Alert.alert` avec bouton
  "destructive"), remboursement — cohérent entre les plateformes.

---

## Verdict

**Progrès réel** (comme l'Audit 5) : un vrai défaut d'accessibilité
systémique (affectant potentiellement des dizaines d'endroits à
travers 3 apps) a été trouvé par un outil, pas par supposition, et
corrigé avec la même rigueur (contraste recalculé et revérifié, pas
choisi à l'œil). Le reste du produit est structurellement sain pour
l'accessibilité de base (pas d'image sans alt, pas d'élément cliquable
piégé pour le clavier). Ce qui manque n'est pas un défaut trouvé mais
une **vérification humaine réelle** (navigation clavier de bout en
bout, lisibilité en extérieur, expérience mobile native) qu'aucun outil
automatisé ne remplace.

## Plan de remédiation

- **P2** : étendre le scan `axe-core` aux écrans `apps/admin` les plus
  utilisés (`Users`, `Drivers`, `Rides`) une fois une suite `e2e`
  dédiée ajoutée à cette app (recommandation déjà notée en Audit 5
  §3).
- **P3** : test manuel de navigation clavier sur les 3 modales
  transverses (`Report`/`Profile`/`Rating`) une fois le site en ligne.

## Ce que je n'ai pas pu vérifier

Voir §3 — navigation clavier réelle, lisibilité en extérieur,
accessibilité native mobile (VoiceOver/TalkBack), responsive sur
appareils réels.
