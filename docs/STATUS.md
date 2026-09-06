# État du projet — VTC Togo

*Dernière mise à jour : 6 septembre 2026 (pipeline de 12 audits
indépendants terminé — production, sécurité web, sécurité Supabase,
architecture, tests, performance, UX/accessibilité, hardening VPS,
sauvegardes/DR, mode développeur autonome, SEO, documentation. Détail
complet et preuves : [`docs/audits/00-pipeline.md`](audits/00-pipeline.md).
Avant cela, réorganisation du dépôt en 3 étapes : dossiers `packages/`
jamais initialisés supprimés, vérification automatique GitHub ajoutée,
documentation éclatée en instantané court + historique daté séparé,
README racine remis à jour, et [`CLAUDE.md`](../CLAUDE.md) créé pour
formaliser les règles permanentes de travail. Raisonnement complet dans
[`DECISIONS.md`](DECISIONS.md), détail de chaque étape dans
[`CHANGELOG.md`](CHANGELOG.md) TASK-051.)*

> Instantané, pas un journal — réécrit à chaque mise à jour
> significative. Historique daté : [`CHANGELOG.md`](CHANGELOG.md).
> Tâches en cours/à faire : [`TASKS.md`](TASKS.md).

## 1. Où en est-on ?

**Le code applicatif est complet pour le périmètre MVP documenté**, sur
les trois plateformes :

- **Backend** : 18 migrations + 5 Edge Functions déployées pour de vrai
  sur le projet Supabase dédié (32 tables, 52 fonctions, 51 policies
  RLS). Vrais tarifs câblés (`pricing_rules`/`subscription_plans`),
  matching avec critère de fiabilité, `pg_cron` actif.
- **`apps/admin`** : les 24 écrans de `docs/05-ecrans.md` sont
  construits et actionnables (utilisateurs, chauffeurs/KYC, véhicules,
  courses, paiements, facturation, abonnements, règlements, zones,
  tarification, réclamations & SOS + tickets support, fraude,
  statistiques, carte live).
- **`apps/web`** : passager et chauffeur complets — demande de course
  avec géolocalisation/carte, suivi, historique + factures PDF,
  notation, SOS, signalement, notifications, support client, profil.
  Testé en conditions réelles par le porteur du projet en local.
- **`apps/mobile`** (Expo, Android + iOS, un seul code) : même
  périmètre qu'`apps/web`, jamais lancé sur un simulateur/appareil réel
  (voir §3).

## 2. Ce qui fonctionne

Détail complet de chaque fonctionnalité et sa date de construction :
[`CHANGELOG.md`](CHANGELOG.md) (TASK-001 à TASK-050). En résumé, tout
le parcours MVP fonctionne de bout en bout : inscription/connexion par
code email, demande de course avec tarif réel et matching, abonnement
chauffeur, paiement (cash + Mobile Money en mode manuel), facturation
automatique, notation, notifications, support, anti-fraude (appareils
partagés + anomalies GPS + limitation de débit), et l'intégralité du
dashboard admin.

**Réorganisation du dépôt (6 septembre 2026)** — vérification
automatique GitHub à chaque envoi (`.github/workflows/ci.yml`,
compilation + construction + contrôle de code par application, aussi
lançable en une commande locale : `npm run verify`) ; dossiers
`packages/` (jamais utilisés) supprimés ; documentation réorganisée
(`CHANGELOG.md`, `DECISIONS.md` nouveaux) ; README racine remis à jour ;
[`CLAUDE.md`](../CLAUDE.md) créé (règles permanentes de travail sur ce
dépôt, pour qu'une nouvelle session reprenne sans relire la
conversation) ; les 4 fichiers d'écran dépassant 550 lignes découpés en
sous-fichiers par sujet (plus aucun fichier de code ne dépasse
500 lignes).

## 3. Ce qui pose problème / limites connues

- **🔴 Aucune sauvegarde de la base de données — le projet Supabase est
  sur le plan Free.** Confirmé par requête directe (organisation
  `VTC-TOGO`, `plan: free`) le 6 septembre 2026 — voir
  [`docs/audits/09-audit-backups-monitoring-dr.md`](audits/09-audit-backups-monitoring-dr.md).
  Sur ce plan, Supabase ne propose **aucune sauvegarde automatique**
  (ni quotidienne, ni PITR) : en cas d'incident, toute donnée réelle
  (comptes, courses, paiements, documents KYC) serait **perdue
  définitivement**, sans recours. Sans impact tant que seules des
  données de développement existent — devient un risque réel dès le
  premier vrai utilisateur. Passer au plan Pro avant tout lancement
  réel est une condition de base, pas une amélioration optionnelle.
- **Notifications push jamais livrées à un vrai appareil** — le code
  est en place mais bloqué par deux points externes : aucun projet
  Expo créé (§7) et, une fois obtenu, Expo Go seul ne reçoit plus les
  push distants sur Android depuis le SDK 53 (limite Expo) — un build
  de développement sera nécessaire.
- **`apps/mobile` jamais testé sur un simulateur/appareil réel** —
  seulement vérifié en mode web faute d'environnement adapté. Trois
  confirmations (`Alert.alert` : achat d'abonnement, paiement cash,
  annulation) et le rendu réel de la carte de géolocalisation restent
  à confirmer sur un vrai téléphone.
- **Carte live admin et facturation détail non vérifiées avec de
  vraies données** — code et route corrects, mais pas encore de vraie
  facture ni de connexion admin fonctionnelle pour le confirmer (voir
  point suivant).
- **Mot de passe du compte admin probablement inutilisable** — ce
  compte a été créé comme passager (code email), jamais via un
  formulaire mot de passe. Réinitialiser depuis Dashboard Supabase →
  Authentication → Users si `/login` échoue.
- **Auto-complétion d'adresse (Google Places) délibérément pas
  construite** — remplacée par géolocalisation + carte, qui correspond
  mieux à la réalité togolaise (adresses peu standardisées).
- **Custody des fonds Mobile Money d'une course, non tranchée** — voir
  `docs/10-paiements.md` §Paiement de la course. Un paiement de course
  Mobile Money bloqué ne peut être que marqué échoué par l'admin,
  jamais confirmé à la main (réservé au webhook `service_role`).
- **Mobile Money** : fournisseur non choisi (§7) — non bloquant,
  backend en mode manuel/admin.
- **Protection mots de passe compromis (HaveIBeenPwned) désactivée** —
  interrupteur Dashboard, pas une migration. Deux minutes, quand vous
  voulez.
- **RLS : `auth.uid()` réévalué ligne par ligne** (avis performance
  Supabase, ~36 policies) — présent depuis la première migration, sans
  impact au volume actuel, à corriger comme chantier dédié si le
  volume réel le justifie un jour.
- **`phone-verification-check`/`ESMS_AFRICA_API_KEY`** : circuit
  eSMS Africa abandonné au profit du code email, code conservé en
  réserve pour un futur fournisseur SMS.

## 4. En cours

Rien en cours — en attente de la prochaine demande. Deux tâches
restent ouvertes dans [`TASKS.md`](TASKS.md) (TASK-053, TASK-054), non
bloquantes pour le reste du code — voir §6.

## 5. Dernièrement terminé

**Pipeline de 12 audits indépendants** (6 septembre 2026) — chaque
audit avec preuves réelles (code + interrogation directe du projet
Supabase) et verdict explicite, jamais de case cochée par supposition.
Synthèse complète : [`docs/audits/00-pipeline.md`](audits/00-pipeline.md).
Plusieurs corrections concrètes en sont sorties, au-delà des verdicts
eux-mêmes : 5 tests e2e + accessibilité ajoutés et intégrés au CI
(0 → 5, Audit 5), un bug de contraste réel corrigé dans les 3 apps
(Audit 7), le dossier `docs/` relié/complété avec un glossaire
(Audit 12), et la protection anti-indexation d'`apps/admin` + les
briques SEO de base d'`apps/web` (Audit 11, `TASK-055` — meta
`noindex`/`robots.txt` sur `apps/admin`, meta description/Open Graph
sur `apps/web`). Avant ce pipeline : réorganisation du dépôt en
4 étapes (nettoyage, CI, documentation, README racine + `CLAUDE.md`,
découpage des fichiers d'écran trop volumineux). Détail complet, daté :
voir [`CHANGELOG.md`](CHANGELOG.md), entrées les plus récentes en
premier.

## 6. Prochaine étape

Deux chantiers restent ouverts, aucun ne bloque l'usage actuel du site
en développement — tous deux nécessitent une action de votre part,
pas du code :

- **TASK-054 (critique avant lancement réel)** : passer l'organisation
  Supabase au plan Pro — sans ça, aucune sauvegarde n'existe (voir §3
  et §7). Décision de budget qui vous appartient.
- **TASK-053 (priorité haute)** : le déploiement Vercel d'`apps/admin`
  est en cours (variables d'environnement recréées, redéploiement
  lancé) mais pas encore confirmé fonctionnel, et `apps/web` n'a pas
  encore de projet Vercel. Nécessite vos actions dans l'interface Vercel
  — voir §7.

En dehors de ces deux tâches, ce qui reste est soit externe
(décisions/comptes qui vous appartiennent, §7), soit une vérification
que je ne peux pas faire depuis cet environnement de développement
(rendu natif réel d'`apps/mobile` sur un vrai appareil, upload de
document, confirmations `Alert.alert`, carte live et facturation détail
avec de vraies données).

## 7. Décision(s) / action(s) requise(s) de votre part

- **🔴 Passer l'organisation Supabase au plan Pro avant tout lancement
  réel** (voir §3) — sans ça, aucune sauvegarde n'existe. Décision de
  budget, pas technique.
- **Tester `apps/mobile` sur votre téléphone** (optionnel, quand vous
  voulez) : `cd apps/mobile && npm install && npx expo start`, puis
  scanner le QR code avec l'app **Expo Go** (Android/iOS, gratuite) —
  pas besoin de compte Expo/EAS pour ça.
- **Connexion admin** : essayez `/login` avec `abotchigilles@yahoo.fr`.
  Si ça échoue (probable), réinitialisez le mot de passe depuis
  Dashboard → Authentication → Users → ce compte.
- **Mobile Money** : Flooz, TMoney (direct) ou Semoa Togo (agrégateur)
  — non bloquant. Détermine aussi la réponse à la question de custody
  des fonds notée en §3.
- **Créer un projet Expo** (compte gratuit) pour activer les
  notifications push : `cd apps/mobile && npx eas init`, puis
  renseigner l'identifiant obtenu dans `EXPO_PUBLIC_PROJECT_ID`
  (`.env`). Un vrai test de réception demandera ensuite un build de
  développement (`eas build --profile development`).
- **Comptes développeur mobile** (Play Console, Apple Developer) — non
  bloquant avant publication sur les stores.
- **Régime fiscal togolais** et **statut réglementaire de la collecte
  Mobile Money pour compte de tiers** — à valider avant production
  réelle (voir `docs/01-architecture-fonctionnelle.md` §Rôle des
  parties et `docs/10-paiements.md`).
