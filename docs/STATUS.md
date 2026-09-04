# État du projet — VTC Togo

*Dernière mise à jour : 4 septembre 2026 (accueil passager réel + demande
de course, actions admin sur les paiements manuels, correctif de sécurité
sur les infos publiques chauffeur/passager)*

> Instantané, pas un journal — réécrit à chaque mise à jour significative.

## 1. Où en est-on ?

Le backend (schéma, logique métier, module financier complet, deux
catégories voiture/moto-taxi) est **déployé pour de vrai** sur le projet
Supabase dédié : 14 migrations + 5 Edge Functions en place et vérifiées
(32 tables, 49 fonctions, 51 policies RLS, grants internes durcis).

**Le dashboard admin (`apps/admin/`) est complet et pleinement actionnable** :
les 24 écrans documentés dans `docs/05-ecrans.md` sont construits (certains
regroupés — Règlements et Réclamations & SOS couvrent chacun
liste+détail+action en un seul écran) — connexion, vue d'ensemble,
utilisateurs, chauffeurs/KYC, véhicules, courses, **paiements (liste +
confirmer/marquer échoué/rembourser)**, facturation, abonnements (liste +
plans), règlements, zones, tarification, réclamations & SOS, fraude,
statistiques globales. Tous vérifiés dans un vrai navigateur
(Playwright/Chromium) avec des mocks REST/RPC réalistes ; confirmation
avec de vraies requêtes réseau contre le projet réel non testée depuis cet
environnement (réseau sandbox bloqué vers `*.supabase.co`) — à faire en
local chez vous.

**`apps/web` est maintenant fonctionnellement complet des deux côtés**
(passager et chauffeur), code vérifié de bout en bout, mais bloqué en
usage réel par deux points externes (voir plus bas) :

- **Côté passager** : auth par email confirmée en conditions réelles
  (vous avez créé deux comptes en local, flux `signInWithOtp`/`verifyOtp`
  bout en bout hors sandbox) ; `PassengerHome.tsx` affiche désormais un
  vrai tableau de bord — suivi de la course en cours (infos publiques du
  chauffeur une fois matché, annulation), formulaire de demande de course
  (catégorie, adresses avec coordonnées saisies à la main en attendant
  Google Places, estimation, confirmation), historique des courses
  passées.
- **Côté chauffeur** : auth par email, dépôt de dossier KYC + véhicule,
  et tableau de bord opérationnel complet (abonnement, disponibilité,
  offres de course reçues en Realtime, course en cours jusqu'à
  `complete_ride`).

Bloqué en usage réel, indépendamment du code (§3/§7) :
1. **`GOOGLE_MAPS_API_KEY`** toujours pas fournie — `pricing-directions`
   (Edge Function) répond `not_configured`, l'écran de demande de course
   l'affiche clairement plutôt que d'échouer en silence.
2. **`pricing_rules` toujours vide** sur le projet réel — bloque à la fois
   l'estimation de prix et la clôture d'une course (`complete_ride`). Se
   règle en 30 secondes via `/tarification` (dashboard admin) une fois
   connecté, mais ce sont de vrais tarifs FCFA à décider par vous, jamais
   inventés ici.

**4 livrables** (révision du 3 septembre 2026, détail dans
`docs/02-architecture-technique.md`) : Web, Android, iOS, Admin — chacun
couvrant passager **et** chauffeur sauf l'admin. Android/iOS restent un
seul code Expo (`apps/mobile`), pas encore démarré.

Un serveur **MCP Supabase** est connecté à cette session (accès direct au
projet réel — lecture, migrations, avis de sécurité) mais c'est un canal
séparé de la politique réseau du sandbox : le navigateur ne peut toujours
pas contacter `*.supabase.co` directement depuis cet environnement.

Reste à construire : `apps/mobile` (pas commencé), le worker de dispatch
(écrit, pas déployé).

## 2. Ce qui fonctionne

**Base de données** (14 migrations, vérifiées en local puis déployées,
comptage confirmé identique) : cycle complet d'une course par catégorie
(matching, cash/Mobile Money), frais de service 2,5 % jamais mélangés à
l'abonnement, facturation/règlement/remboursement automatiques, reporting
financier complet (`admin_stats_overview`), KYC/anti-fraude/support
hérités. Migrations 9-12 ont corrigé le même bug d'embedding PostgREST
(FK manquante vers `profiles`) sur `payments`, `invoices`, `user_roles`,
`reports` et `sos_alerts`. Migrations 13-14 ont ajouté
`get_ride_driver_public_info`/`get_ride_passenger_public_info` (seules
portes d'accès aux infos publiques entre passager et chauffeur assignés
à une même course, RLS interdisant tout accès direct) puis corrigé une
faille NULL-safety découverte en vérifiant les grants réels (appel non
authentifié pas correctement rejeté avant le correctif).

**Dashboard admin complet et actionnable** (`apps/admin/`) : voir §1.
Code React 19 + Vite + TanStack Router, même stack que `apps/web`.

**`apps/web` complet des deux côtés** (passager et chauffeur) : voir §1.
Reste bloqué en usage réel par la clé Google Maps et les tarifs (§3).

**5 Edge Functions déployées** (`payment-webhook-momo`,
`phone-verification-start`/`-check`, `pricing-directions`,
`push-notifications-dispatch`) — URLs vérifiées. `push-notifications-dispatch`
tourne réellement de bout en bout via un trigger `pg_net` fait main
(Database Webhook natif cassé sur ce projet, contourné en migration 5).
`phone-verification-start`/`-check` non appelées depuis l'abandon d'eSMS
Africa — conservées, pas supprimées.

**Design** : 37 écrans (canvas Claude Design) — antérieur à la révision
du modèle économique et de l'architecture du 3 septembre ; ne reflète ni
les écrans catégorie/facturation/fraude ni le regroupement
passager+chauffeur par plateforme, ni les 24 écrans admin réels.

## 3. Ce qui pose problème / limites connues

- **Clé API Google Maps manquante** — bloque l'estimation/demande de
  course (§7).
- **`pricing_rules` vide sur le projet réel** — bloque aussi la demande
  de course et la clôture d'une course, indépendamment de Google Maps.
- **Secrets Edge Functions pas tous configurés** : `PAYMENT_WEBHOOK_SECRET`
  (aucune dépendance externe). `ESMS_AFRICA_API_KEY` n'est plus à l'ordre
  du jour (abandonné).
- **Premier compte admin créé** (`abotchigilles@yahoo.fr`,
  `super_admin` inséré dans `admin_roles` via MCP) mais **mot de passe
  probablement inutilisable** : ce compte existait déjà comme compte
  passager (créé via `/passager`, code email — TASK-021), jamais via un
  formulaire email+mot de passe. `/login` (`apps/admin`) utilise
  `signInWithPassword` — réinitialiser le mot de passe depuis Dashboard
  → Authentication → Users si la connexion échoue. Non testable depuis
  ce sandbox (réseau bloqué).
- **Database Webhook natif Supabase cassé sur ce projet** — contourné
  pour `push-notifications-dispatch`, un futur besoin similaire
  rencontrera la même anomalie.
- **Custody des fonds Mobile Money d'une course, non tranchée** (détaillé
  dans [10-paiements.md](10-paiements.md) §Paiement de la course). Lié :
  la confirmation manuelle admin des paiements (TASK-030) ne couvre que
  les abonnements chauffeur — un paiement de course Mobile Money bloqué
  ne peut être que marqué échoué par l'admin, jamais confirmé à la main
  (la confirmation exige la vérification du montant/référence auprès du
  fournisseur, réservée au webhook `service_role`).
- **`phone-verification-check` non testée** — eSMS Africa abandonné,
  circuit en réserve pour un futur fournisseur SMS.
- **Rendu PDF de la facture non construit.**
- **Mobile Money** : fournisseur non choisi (§7) — non bloquant, backend
  en mode manuel/admin.
- **Critère de fiabilité du matching non implémenté** (doc 08).
- **Protection mots de passe compromis (HaveIBeenPwned) désactivée** —
  interrupteur dashboard (Authentication → Password protection), pas une
  migration. Deux minutes, quand vous voulez.

## 4. En cours

Rien en cours — en attente de la prochaine demande.

## 5. Dernièrement terminé

**4 septembre 2026** — détail complet dans `docs/TASKS.md` (TASK-029 à
TASK-031) : **côté chauffeur de `apps/web` construit** (auth, dépôt de
dossier KYC + véhicule, tableau de bord avec abonnement/disponibilité/
offres/course en cours) ; **actions admin sur les paiements manuels**
(Confirmer/Marquer échoué/Rembourser sur `/paiements`) ; **accueil
passager réel + demande de course** (suivi de course, formulaire de
demande avec estimation, historique) ; deux fonctions dédiées pour les
infos publiques chauffeur↔passager (migration 13) et un correctif de
sécurité NULL-safety découvert en vérifiant les grants réels après coup
(migration 14) — a aussi révélé et corrigé un embed PostgREST déjà
silencieusement cassé côté chauffeur (infos passager jamais affichées en
production).

**3 septembre 2026** — détail complet dans `docs/TASKS.md` (TASK-004 à
TASK-028) : nav admin regroupée par domaine + README admin rafraîchi ;
premier compte admin bootstrappé ; révision du modèle économique
(catégories, frais de service) ; module paiement/abonnement/facturation ;
déploiement réel du schéma (12 migrations) et des 5 Edge Functions ;
contournement `pg_net` pour les push ; les 24 écrans du dashboard admin,
un à un ; bucket Storage `driver-documents` ; correction récurrente d'un
bug d'embedding PostgREST (5 tables) ; MCP Supabase connecté +
durcissement de 13 grants internes ; révision d'architecture
(4 plateformes) ; `apps/web` scaffoldé + auth passager par code email ;
eSMS Africa abandonné (documentation).

Antérieurement (2 septembre 2026) : backend initial complet (schéma,
~35 fonctions, worker, 5 Edge Functions), cadrage (12 livrables), design
UX/UI (37 écrans) — détail dans l'historique de conversation.

## 6. Prochaine étape

Le code applicatif (dashboard admin + `apps/web` passager/chauffeur) est
terminé pour le périmètre MVP documenté. Les chantiers restants sont tous
soit externes (décisions/comptes qui vous appartiennent, §7), soit hors
périmètre immédiat (`apps/mobile`, worker de dispatch pas déployé).
Aucun chantier de code n'est bloqué en attente d'une décision technique —
seulement en attente de vos décisions/actions (§7).

## 7. Décision(s) / action(s) requise(s) de votre part

- **Clé API Google Maps** (fournisseur décidé le 3 septembre 2026) —
  console.cloud.google.com, activer *Directions API*, *Places API* et
  *Maps JavaScript API* sur un même projet, puis créer deux clés :
  1. Une clé **sans restriction de referrer**, avec seulement
     *Directions API* activée — c'est `GOOGLE_MAPS_API_KEY`, le secret
     Edge Function déjà en attente.
  2. Une clé **restreinte par referrer HTTP** (votre domaine, ou
     `localhost` pour tester) avec *Places API* + *Maps JavaScript API*
     — celle-ci sera visible côté navigateur par construction (comme
     toute clé Maps JS), la restriction de referrer est ce qui la
     protège d'un usage détourné.
- **Tarifs réels** (`pricing_rules`) — prix de base, prix/km, prix/min,
  tarif minimum et majoration de nuit par catégorie (voiture/moto-taxi),
  éventuellement par zone. Se saisit via `/tarification` une fois
  connecté à l'admin — decision business, jamais inventée dans le code.
- **Connexion admin** : essayez `/login` avec `abotchigilles@yahoo.fr`.
  Si ça échoue (probable — voir §3), réinitialisez le mot de passe
  depuis Dashboard → Authentication → Users → ce compte.
- **Mobile Money** : Flooz, TMoney (direct) ou Semoa Togo (agrégateur) —
  non bloquant. Détermine aussi la réponse à la question de custody des
  fonds notée en §3.
- **Comptes développeur mobile** (Expo/EAS, Play Console, Apple
  Developer) — non bloquant avant la Phase 9.
- **Régime fiscal togolais** (facturation pour compte du chauffeur) et
  **statut réglementaire de la collecte Mobile Money pour compte de
  tiers** — à valider avant production réelle (voir
  [01-architecture-fonctionnelle.md](01-architecture-fonctionnelle.md)
  §Rôle des parties et [10-paiements.md](10-paiements.md)).
