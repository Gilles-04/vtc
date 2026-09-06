# 13 — Glossaire

Définitions courtes des termes techniques utilisés dans ce dossier
documentaire (les 12 livrables de cadrage et les 12 audits), écrites
pour quelqu'un qui suit le projet sans être développeur. Chaque entrée
pointe vers le document où le sujet est traité en détail.

## Produit

- **VTC** : Voiture de Transport avec Chauffeur — catégorie « voiture »
  du service, en parallèle de la catégorie moto-taxi (voir
  [01-architecture-fonctionnelle.md](01-architecture-fonctionnelle.md)).
- **Pass Jour** : l'abonnement à durée fixe (24 h) qu'un chauffeur paie
  pour recevoir des courses — pas une commission sur le prix payé par
  le passager (voir [09-abonnement.md](09-abonnement.md)).
- **Frais de service** : les 2,5 % prélevés sur chaque course, distincts
  du Pass Jour (voir [10-paiements.md](10-paiements.md)).
- **KYC** (*Know Your Customer*) : la vérification d'identité d'un
  chauffeur avant qu'il puisse recevoir des courses (permis, carte grise,
  photo) — traité par l'admin dans l'écran Chauffeurs (voir
  [05-ecrans.md](05-ecrans.md)).
- **Matching** : l'algorithme qui associe une demande de course
  passager au chauffeur disponible le plus pertinent (voir
  [08-matching.md](08-matching.md)).
- **Mobile Money** : moyen de paiement mobile courant en Afrique de
  l'Ouest (Flooz, TMoney...) — fournisseur pas encore choisi pour ce
  projet (voir [10-paiements.md](10-paiements.md) et
  `docs/STATUS.md` §7).

## Technique général

- **Monorepo** : un seul dépôt Git contenant plusieurs applications
  (`apps/web`, `apps/admin`, `apps/mobile`) qui partagent une même
  base de code et un historique commun.
- **Workspace npm** : le mécanisme qui permet à ces plusieurs
  applications de cohabiter dans un seul `npm install` à la racine.
- **SPA** (*Single Page Application*) : un site où une seule page HTML
  est chargée puis tout le contenu est généré par JavaScript dans le
  navigateur, sans rechargement complet à chaque page — c'est le cas
  d'`apps/web` et `apps/admin` (voir
  [`docs/audits/11-audit-seo.md`](audits/11-audit-seo.md) §3 pour les
  conséquences sur le référencement).
- **SSR/SSG** (*Server-Side Rendering* / *Static Site Generation*) :
  des techniques où le HTML est déjà prêt avant d'arriver dans le
  navigateur (plus rapide à afficher, meilleur pour le référencement)
  — **non utilisées** dans ce projet, qui reste une SPA pure.
- **CI** (*Intégration continue*) : la vérification automatique
  (compilation + construction + contrôle de code) qui tourne sur
  GitHub à chaque envoi de code (`.github/workflows/ci.yml`), rejouable
  en local avec `npm run verify`.
- **Bundle** : le fichier JavaScript final envoyé au navigateur ; plus
  il est gros, plus le chargement initial est lent (voir
  [`docs/audits/06-audit-performance.md`](audits/06-audit-performance.md)).

## Supabase / base de données

- **Supabase** : le fournisseur qui héberge la base de données
  (Postgres), l'authentification, le stockage de fichiers et les
  fonctions serveur (Edge Functions) de ce projet — voir
  [02-architecture-technique.md](02-architecture-technique.md).
- **Migration (SQL)** : un fichier qui décrit un changement du schéma
  de base de données (nouvelle table, nouvelle règle...), rejoué dans
  l'ordre pour reconstruire la base — voir
  [06-schema-base-donnees.md](06-schema-base-donnees.md).
- **RLS** (*Row-Level Security*) : le mécanisme Postgres qui empêche un
  utilisateur de voir/modifier les lignes d'une table qui ne lui
  appartiennent pas, même s'il a un accès technique à cette table —
  c'est la principale protection des données de ce projet (voir
  [11-securite.md](11-securite.md) et
  [`docs/audits/03-audit-securite-supabase.md`](audits/03-audit-securite-supabase.md)).
  Attention à ne pas confondre les deux sujets : RLS protège **qui peut
  voir quelles données**, pas la continuité du service en cas
  d'incident (ça, c'est le rôle des sauvegardes — voir
  [`docs/audits/09-audit-backups-monitoring-dr.md`](audits/09-audit-backups-monitoring-dr.md)).
- **RPC** (*Remote Procedure Call*) : une fonction SQL appelée
  directement depuis le code des applications (au lieu d'une requête
  brute), utilisée pour toute opération sensible (paiement, matching...)
  — voir [07-api.md](07-api.md).
- **`SECURITY DEFINER`** : un mode d'exécution d'une fonction SQL avec
  les droits de son créateur plutôt que de l'appelant — nécessaire pour
  certaines opérations privilégiées, mais qui doit toujours fixer
  explicitement son `search_path` pour rester sûr (voir
  [`docs/audits/03-audit-securite-supabase.md`](audits/03-audit-securite-supabase.md)).
- **`pg_cron`** : le planificateur de tâches intégré à Postgres qui
  exécute automatiquement certaines actions à intervalle régulier
  (relance d'une course bloquée, expiration d'abonnement...) — voir
  [08-matching.md](08-matching.md) et
  [`docs/audits/09-audit-backups-monitoring-dr.md`](audits/09-audit-backups-monitoring-dr.md).
- **Edge Function** : un petit programme serveur hébergé par Supabase
  (pas dans le navigateur), utilisé pour les opérations qui doivent
  rester côté serveur (paiement, notifications push...) — voir
  [07-api.md](07-api.md).
- **PITR** (*Point-in-Time Recovery*) : une fonctionnalité de
  sauvegarde qui permet de restaurer la base à n'importe quel instant
  précis dans le passé — **non disponible** sur le plan Supabase actuel
  (Free), voir
  [`docs/audits/09-audit-backups-monitoring-dr.md`](audits/09-audit-backups-monitoring-dr.md).

## Sécurité

- **OWASP** : une référence internationale des failles de sécurité web
  les plus courantes, utilisée comme grille de lecture dans
  [`docs/audits/02-audit-securite-web.md`](audits/02-audit-securite-web.md).
- **JWT** (*JSON Web Token*) : le jeton signé qui prouve qu'un
  utilisateur est connecté, géré automatiquement par Supabase Auth.
- **OTP** (*One-Time Password*) : le code à usage unique envoyé par
  email pour se connecter, sans mot de passe — voir
  [11-securite.md](11-securite.md).
- **SPOF** (*Single Point of Failure*) : un composant dont la panne
  arrête tout le service, sans solution de repli — identifiés en
  [`docs/audits/04-audit-architecture.md`](audits/04-audit-architecture.md)
  et [`docs/audits/09-audit-backups-monitoring-dr.md`](audits/09-audit-backups-monitoring-dr.md).
- **RTO / RPO** (*Recovery Time/Point Objective*) : combien de temps
  pour redémarrer le service après un incident (RTO), et combien de
  données récentes seraient perdues (RPO) — voir
  [`docs/audits/09-audit-backups-monitoring-dr.md`](audits/09-audit-backups-monitoring-dr.md).

## Performance et accessibilité

- **N+1** : un défaut courant où une page fait une requête réseau par
  élément d'une liste au lieu d'une seule requête groupée, ce qui
  ralentit tout à mesure que la liste grandit — trouvé une fois dans ce
  projet, voir
  [`docs/audits/06-audit-performance.md`](audits/06-audit-performance.md).
- **WCAG** : la norme internationale d'accessibilité web (contraste des
  couleurs, navigation clavier, lecteurs d'écran) — un vrai défaut de
  contraste a été trouvé et corrigé grâce à cette norme, voir
  [`docs/audits/07-audit-ux-ui.md`](audits/07-audit-ux-ui.md).
- **Core Web Vitals** : les indicateurs de vitesse/fluidité que Google
  utilise notamment pour le référencement — non mesurables pour
  l'instant faute d'URL publique (voir
  [`docs/audits/11-audit-seo.md`](audits/11-audit-seo.md)).

## Référencement (SEO)

- **`robots.txt`** / **balise `noindex`** : les moyens standards de dire
  aux moteurs de recherche quelles pages indexer ou non — absents de ce
  projet à ce jour, voir
  [`docs/audits/11-audit-seo.md`](audits/11-audit-seo.md).
- **Open Graph** : les balises qui contrôlent l'aperçu (titre, image,
  description) d'un lien partagé sur WhatsApp/Facebook — absentes à ce
  jour, voir [`docs/audits/11-audit-seo.md`](audits/11-audit-seo.md) §1.
- **Données structurées (JSON-LD)** : un balisage caché dans une page
  qui aide un moteur de recherche à comprendre son contenu (ex. « ceci
  est une entreprise de transport ») — non présent, non urgent tant que
  le site n'est pas en ligne.

## Déploiement

- **VPS** (*Virtual Private Server*) : un serveur loué à l'année sur
  lequel on installe soi-même tout le nécessaire — **ce projet n'en a
  pas** (hébergement Supabase + Vercel, sans serveur à gérer), voir
  [`docs/audits/08-audit-hardening-vps.md`](audits/08-audit-hardening-vps.md).
- **Vercel** : le service qui héberge et déploie `apps/web` et
  `apps/admin` — voir `docs/TASKS.md` (TASK-053).
- **Variable d'environnement** : une valeur de configuration (clé API,
  URL...) fournie à l'application sans être écrite dans le code —
  jamais un secret réel dans un fichier `.env.example` (voir
  `CLAUDE.md`).
