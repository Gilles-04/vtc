# Audit 11/12 — SEO intégral et optimisation complète du site

*Réalisé le 6 septembre 2026. Méthode : lecture directe du code
(`index.html`, routage, dépôt public/) des deux apps web
(`apps/web`, `apps/admin`) — aucun outil externe interrogé (Search
Console, PageSpeed Insights) car, comme confirmé en Audit 1 §14/§24,
**aucune des deux apps n'a d'URL publique fonctionnelle à ce jour**.
`apps/mobile` est hors périmètre (app native, jamais publiée sur un
store, non indexable par un moteur de recherche web).*

---

## Réponse directe

> « Le site est-il prêt à être référencé par un moteur de recherche ? »

**Non — et pour l'instant la question ne se pose pas encore
réellement** : `apps/web` n'a aucun déploiement public (TASK-053), donc
rien à indexer. Une fois en ligne, l'état actuel du code produirait un
référencement **minimal** : la page d'accueil contient du vrai texte
utile (bon point, détaillé en §2), mais **aucune des briques SEO
techniques standards n'est en place** — pas de balise meta description,
pas d'Open Graph/Twitter Card, pas de `robots.txt`, pas de
`sitemap.xml`, pas de données structurées. Point plus préoccupant sur
`apps/admin` : **rien n'empêche son indexation** si son URL Vercel
devient publique sans protection (§4).

Conséquence directe de l'absence d'URL publique : **la quasi-totalité
des vérifications SEO « en conditions réelles »** (résultat Google
PageSpeed Insights, test mobile-friendly, statut d'indexation réel
Search Console, aperçu de partage WhatsApp/Facebook) **est NON
VÉRIFIABLE** depuis cet audit — signalé section par section plutôt que
supposé bon ou mauvais.

---

## 1. `apps/web/index.html` — ce qui existe

**CONFIRMÉ, lecture directe du fichier** :

| Élément | État |
|---|---|
| `<html lang="fr">` | ✅ Correct — cohérent avec le public togolais francophone |
| `<meta charset="UTF-8">` | ✅ Présent |
| `<meta name="viewport" ...>` | ✅ Présent (`width=device-width, initial-scale=1.0`) — condition de base du signal « mobile-friendly » |
| `<title>` | ⚠️ Présent mais **statique et unique** : `VTC Togo` sur toutes les routes (voir §3) |
| `<meta name="description">` | ❌ **Absente** |
| Open Graph (`og:title`, `og:description`, `og:image`) | ❌ **Absents** |
| Twitter Card | ❌ **Absente** |
| `<link rel="canonical">` | ❌ **Absent** |
| Favicon | `favicon.svg` seul — pas d'`apple-touch-icon` ni de PNG multi-tailles (mineur, cosmétique sur certains partages/anciens navigateurs) |
| Données structurées (JSON-LD, `schema.org`) | ❌ **Absentes** — aucun balisage `LocalBusiness`/`Organization`/`Service` |

**Impact concret le plus tangible pour ce projet** : l'absence
d'Open Graph signifie qu'un lien `vtc-togo.xxx` partagé sur **WhatsApp**
— canal de partage de loin le plus utilisé au Togo, bien davantage que
Twitter/Facebook — s'affichera **sans image ni description**, juste
l'URL brute. C'est un vrai coût d'acquisition, pas un détail
esthétique, pour un produit qui dépendra largement du bouche-à-oreille
numérique.

---

## 2. Contenu de la page d'accueil — un vrai point positif

**CONFIRMÉ, lecture de `apps/web/src/pages/Home.tsx`** : contrairement
à beaucoup de SPA dont la page d'accueil est vide de texte, `/`
contient du contenu sémantique réel et pertinent pour le
référencement : un `<h1>` descriptif (« Votre course, en un clic —
voiture ou moto-taxi »), un paragraphe explicatif, une structure `<h2>`
pour les deux parcours (passager/chauffeur). C'est exactement le genre
de contenu qu'un moteur de recherche peut indexer utilement — à
condition qu'il exécute le JavaScript de la page (voir §3).

---

## 3. Architecture SPA pure — implication directe sur l'indexation

**CONFIRMÉ** : `apps/web` utilise `@tanstack/react-router` (routage
client pur), **pas** TanStack Start ni aucun mécanisme de rendu côté
serveur (SSR) ou de pré-rendu statique (SSG) — `vite.config.ts` ne
contient que les plugins React/Tailwind, aucun plugin SSR/prerender.
`vercel.json` confirme un `rewrite` générique
(`"source": "/(.*)", "destination": "/index.html"`) : **chaque route
sert exactement le même fichier HTML**, avec le même `<title>` et
l'absence des mêmes balises meta, quel que soit le contenu réel affiché
une fois le JavaScript exécuté.

**Conséquence graduée, pas binaire** :
- **Googlebot** exécute le JavaScript avant indexation depuis plusieurs
  années — le contenu de `/` (§2) sera donc probablement indexable tel
  quel, avec un délai (rendu différé) par rapport à une page pré-rendue.
- **Les crawlers de réseaux sociaux** (aperçu de lien WhatsApp,
  Facebook, Twitter) **n'exécutent généralement pas le JavaScript** —
  ils ne verront que le `<title>`/meta statique du HTML brut, donc
  aucune image ni description tant que §1 n'est pas corrigé.
- Chaque route (`/passager`, `/chauffeur`, etc.) partage le même
  `<title>` générique « VTC Togo » — un moteur de recherche qui
  indexerait plusieurs pages du site les verrait toutes avec le même
  titre, ce qui dilue leur pertinence respective dans les résultats.

Ce n'est **pas une erreur de code** — c'est un choix d'architecture
(SPA simple, cohérent avec un produit qui est d'abord une application
transactionnelle, pas un site de contenu) qui a un coût SEO réel mais
mesuré, cohérent avec le constat de l'Audit 4 (architecture saine dans
l'ensemble).

---

## 4. `apps/admin` — absence de protection anti-indexation (point le plus important de cet audit)

**CONFIRMÉ** : recherche exhaustive de `noindex`/`robots` dans
`apps/admin/index.html` et `apps/admin/src/` → **aucune occurrence**.
Aucun `robots.txt` avec `Disallow: /` non plus (§5).

`apps/admin` est un back-office **privé**, réservé au personnel
(`docs/STATUS.md` — connexion staff dédiée). Si son URL Vercel devient
un jour accessible publiquement (TASK-053 en cours) **sans protection
d'accès au niveau plateforme** (Vercel Deployment Protection, mot de
passe, ou restriction IP), **rien dans le code n'empêche un moteur de
recherche de l'indexer et de faire apparaître ses pages dans les
résultats** — pages de connexion, structure de navigation admin, noms
d'écrans internes (chauffeurs, KYC, paiements, fraude). Ce n'est pas
une fuite de données (l'accès aux données elles-mêmes reste protégé par
Supabase Auth/RLS, audités aux étapes 2/3), mais une **exposition
d'informations structurelles sur l'outil interne** qui n'a aucune
raison d'être publique.

**C'est une lacune facile à corriger et à faible risque** : ajouter
`<meta name="robots" content="noindex, nofollow">` dans
`apps/admin/index.html` (et éventuellement un `robots.txt` dédié) ne
change rien au fonctionnement de l'app, juste à sa visibilité pour les
crawlers.

---

## 5. `robots.txt` et `sitemap.xml` — état réel

**CONFIRMÉ, recherche exhaustive sur tout le dépôt** : aucun fichier
`robots.txt` ni `sitemap*.xml`, dans `apps/web/public/` comme
`apps/admin/public/` (qui ne contiennent chacun que `favicon.svg` et
`icons.svg`).

Sans `robots.txt`, le comportement par défaut des crawlers est
d'indexer tout ce qui est public — ce qui, combiné à l'absence de
`noindex` sur `apps/admin` (§4), aggrave le point précédent plutôt que
de le neutraliser par défaut.

Un `sitemap.xml` a un intérêt limité pour ce produit : `apps/web` n'a
qu'une poignée de routes publiques réelles (`/`, `/passager`,
`/chauffeur` — le reste nécessite une session active et n'a pas
vocation à être indexé). Son absence n'est pas critique, mais reste une
brique standard manquante.

---

## 6. Performance et Core Web Vitals — renvoi à l'Audit 6

**Pas dupliqué ici** : la performance (temps de chargement, taille de
bundle, découpage par route) est un facteur de classement SEO reconnu,
déjà audité en détail dans
[`06-audit-performance.md`](06-audit-performance.md) (deux causes
racines trouvées : bundle admin non découpé par route, appels Storage
N+1). Rien de nouveau à ajouter du point de vue spécifiquement SEO —
les mêmes corrections serviraient les deux objectifs.

---

## 7. `apps/mobile` — hors périmètre, justifié

**NON APPLICABLE, confirmé** : une application native (Expo) n'est pas
indexée par les moteurs de recherche web classiques. L'équivalent SEO
pour une app mobile est l'**ASO** (App Store Optimization : fiche
Play Store/App Store, mots-clés, captures d'écran) — non applicable ici
car **aucune fiche store n'existe encore** (`docs/STATUS.md` §7 :
comptes développeur Play Console/Apple Developer non créés, non
bloquant avant publication). Rien à auditer tant que l'app n'est pas
soumise à un store.

---

## Verdict

🟡 **SEO minimal, cohérent avec un produit en développement sans URL
publique.** Aucune erreur grave de code, mais **aucune des briques SEO
techniques standards n'est en place** (meta description, Open Graph,
`robots.txt`, sitemap, données structurées) et **un vrai point de
vigilance sécurité/exposition** existe sur `apps/admin` (§4) : à
corriger avant toute mise en ligne publique, pas seulement pour le
référencement mais pour éviter l'exposition non intentionnelle d'un
outil interne.

Le SEO n'est structurellement **pas la priorité actuelle** de ce
projet — cohérent avec les blocages déjà identifiés (Audit 1 : pas
d'URL publique du tout ; Audit 9 : pas de sauvegardes). Corriger le
SEO d'un site qui n'existe pas encore publiquement serait prématuré ;
les correctifs ci-dessous sont peu coûteux et peuvent être faits
n'importe quand avant le lancement réel.

## Plan de remédiation

- **P0 — avant toute mise en ligne publique d'`apps/admin`** : ajouter
  `<meta name="robots" content="noindex, nofollow">` dans
  `apps/admin/index.html`. Coût : une ligne. Empêche l'indexation
  accidentelle d'un outil interne (§4).
- **P1** : ajouter à `apps/web/index.html` une
  `<meta name="description">` réelle (une phrase reprenant le contenu
  de `Home.tsx`, ex. « Commandez une course voiture ou moto-taxi au
  Togo, directement depuis votre navigateur ») et les balises Open
  Graph de base (`og:title`, `og:description`, `og:image` avec une
  image de partage dédiée) — bénéfice direct et mesurable sur le
  partage WhatsApp (§1).
- **P2** : ajouter un `<title>` dynamique par route dans `apps/web`
  (ex. via un petit hook qui met à jour `document.title` dans chaque
  page, sans dépendance supplémentaire) — au minimum sur les 2-3 routes
  publiques réelles (`/`, `/passager`, `/chauffeur`).
- **P2** : ajouter un `robots.txt` minimal à `apps/web/public/`
  (autoriser tout, pointer vers un futur sitemap) et à
  `apps/admin/public/` (`Disallow: /`, en complément du `noindex` P0,
  défense en profondeur).
- **P3** : données structurées JSON-LD (`LocalBusiness` ou `Service`)
  sur la page d'accueil `apps/web` une fois une URL publique stable
  disponible — utile pour un référencement local (Togo/Lomé) mais sans
  urgence tant que le site n'est pas en ligne.
- **P3** : `sitemap.xml` pour `apps/web` (3-4 routes publiques réelles)
  — faible priorité vu le nombre réduit de pages indexables.

## Ce que je n'ai pas pu vérifier

- **Résultat Google PageSpeed Insights / Core Web Vitals réels** —
  nécessite une URL publique, inexistante (Audit 1 §14/§24).
- **Statut d'indexation réel dans Google Search Console** — nécessite
  une propriété Search Console configurée sur un domaine public,
  inexistante.
- **Aperçu réel d'un lien partagé sur WhatsApp/Facebook** — dépend
  autant de l'URL publique que des correctifs P1 ci-dessus ; à tester
  une fois les deux disponibles.
- **Test mobile-friendly officiel Google** — même limite (nécessite une
  URL publique).
