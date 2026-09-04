# État du projet — VTC Togo

*Dernière mise à jour : 4 septembre 2026 (écran Revenus + historique de
courses chauffeur construit ; les deux rendus PDF manquants — reçu
d'abonnement et facture de course — construits ; position du chauffeur
câblée sur les deux plateformes, le matching peut fonctionner de bout en
bout côté fourniture de position ; vrais tarifs câblés ; `apps/mobile`
complet côté passager/chauffeur, rendu natif réel non vérifié — détail
des tâches dans `docs/TASKS.md`)*

> Instantané, pas un journal — réécrit à chaque mise à jour significative.

## 1. Où en est-on ?

Le backend (schéma, logique métier, module financier complet, deux
catégories voiture/moto-taxi) est **déployé pour de vrai** sur le projet
Supabase dédié : 15 migrations + 5 Edge Functions en place et vérifiées
(32 tables, 49 fonctions, 51 policies RLS, grants internes durcis).
**Les vrais tarifs sont câblés** (`pricing_rules` + `subscription_plans`,
migration 15) — plus aucun tarif inventé ni manquant.

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
usage réel par un seul point externe désormais (voir plus bas) :

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

Bloqué en usage réel par un seul point désormais (§3/§7) :
**`GOOGLE_MAPS_API_KEY`** toujours pas fournie — `pricing-directions`
(Edge Function) répond `not_configured`, l'écran de demande de course
l'affiche clairement plutôt que d'échouer en silence. Les tarifs
(`pricing_rules`) ne bloquent plus rien, câblés le 4 septembre (§5).

**Le matching n'était en réalité pas fonctionnel jusqu'à aujourd'hui,
sur aucune des deux plateformes** — indépendamment de la clé Google Maps
et des tarifs. `dispatch_next_offer` exige une position chauffeur récente
(`update_driver_location`, existante et accordée depuis la migration 2),
mais aucun client ne l'appelait jamais. Corrigé le 4 septembre (TASK-035,
§5) : suivi de position en continu (foreground uniquement) tant que le
chauffeur est disponible, y compris pendant une course, sur `apps/web`
et `apps/mobile`.

**4 livrables** (révision du 3 septembre 2026, détail dans
`docs/02-architecture-technique.md`) : Web, Android, iOS, Admin — chacun
couvrant passager **et** chauffeur sauf l'admin. Android/iOS = un seul
code Expo (`apps/mobile`) — **complet côté code** depuis le 4 septembre
2026 : accueil, auth par code email, tableau de bord chauffeur (dossier,
documents, abonnement, disponibilité, offres, course en cours) et demande
de course passager (suivi, formulaire, historique), portés directement
depuis `apps/web` (mêmes RPC/Edge Function, même logique). Vérifié via le
mode web d'Expo + Playwright (aucun émulateur Android/iOS disponible dans
cet environnement — pas de SDK Android, pas d'Xcode). **Non vérifié** :
rendu natif réel sur simulateur/appareil, upload de document réel, et
trois confirmations (`Alert.alert`, un no-op confirmé sur le mode web
utilisé ici — fonctionne normalement sur appareil réel) : achat
d'abonnement, paiement cash confirmé, annulation de course.

Un serveur **MCP Supabase** est connecté à cette session (accès direct au
projet réel — lecture, migrations, avis de sécurité) mais c'est un canal
séparé de la politique réseau du sandbox : le navigateur ne peut toujours
pas contacter `*.supabase.co` directement depuis cet environnement.

Reste à construire : notifications push et géolocalisation en arrière-plan
côté `apps/mobile` (hors périmètre porté ce jour), le worker de dispatch
(écrit, pas déployé).

## 2. Ce qui fonctionne

**Base de données** (15 migrations, vérifiées en local puis déployées,
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
authentifié pas correctement rejeté avant le correctif). Migration 15 a
câblé les vrais tarifs (`pricing_rules`, `subscription_plans`) et corrigé
un repli manquant sur la majoration de nuit (ne se déclenchait jamais
sans zone sélectionnée — la sélection de zone est optionnelle côté
passager et la table `zones` est vide sur le projet réel).

**Dashboard admin complet et actionnable** (`apps/admin/`) : voir §1.
Code React 19 + Vite + TanStack Router, même stack que `apps/web`.

**`apps/web` complet des deux côtés** (passager et chauffeur) : voir §1.
Reste bloqué en usage réel uniquement par la clé Google Maps (§3).

**`apps/mobile` complet côté code, même périmètre qu'`apps/web`** : voir
§1. Rendu natif réel non vérifié dans cet environnement (§3).

**Position du chauffeur envoyée en continu** (`update_driver_location`,
foreground uniquement) sur `apps/web` (API géolocalisation du navigateur)
et `apps/mobile` (`expo-location`) — condition nécessaire au matching
(`dispatch_next_offer`), absente sur les deux plateformes jusqu'au
4 septembre (TASK-035 dans `docs/TASKS.md`).

**Reçu PDF d'abonnement chauffeur** (`apps/web`, `jsPDF`) — un par
paiement d'abonnement réussi, téléchargeable depuis le tableau de bord
chauffeur (TASK-036 dans `docs/TASKS.md`).

**Facture PDF de course** (`apps/web`, même `jsPDF`) — téléchargeable
depuis l'historique passager (TASK-037) **et** depuis l'écran Revenus du
chauffeur (TASK-038, ci-dessous) pour chaque course facturée. Les deux
rendus PDF ne couvrent que `apps/web`, pas `apps/mobile`.

**Écran Revenus + historique de courses chauffeur** (`apps/web`,
`docs/05-ecrans.md` écran #18) — gains transport jour/7 jours/mois
(`invoices.transport_amount_fcfa`, net des frais de service par
construction), historique des 20 dernières courses, bouton Facture
(TASK-038 dans `docs/TASKS.md`).

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
  course (§7). Seul point bloquant restant sur ce parcours.
- **`apps/mobile` jamais lancé sur un simulateur/appareil réel** — cet
  environnement n'a ni SDK Android ni Xcode, uniquement vérifié via le
  mode web d'Expo. Trois confirmations (`Alert.alert`, achat d'abonnement/
  paiement cash/annulation) n'ont pas pu être exercées en conséquence
  (no-op côté web, fonctionnent normalement sur appareil réel).
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

**4 septembre 2026** — détail complet dans `docs/TASKS.md` (TASK-038) :
**écran Revenus + historique de courses chauffeur construit**
(`docs/05-ecrans.md` écran #18, jamais fait jusqu'ici) — tuiles de gains
jour/7 jours/mois (`invoices.transport_amount_fcfa`, calculées côté
client sur une seule requête bornée au mois), historique des 20
dernières courses, bouton Facture réutilisant `generateRideInvoicePdf`
(TASK-037) avec les infos chauffeur prises directement dans l'état local
(pas d'appel RPC redondant sur soi-même) et le nom du passager via
`get_ride_passenger_public_info`. Ferme au passage la dissymétrie notée
en clôturant TASK-037 (le chauffeur n'avait aucun moyen d'accéder à la
facture de ses propres courses).

**Toujours le 4 septembre 2026** — détail complet dans `docs/TASKS.md` (TASK-037) :
**facture PDF de course construite** — le deuxième des deux manques de
rendu PDF identifiés ce jour (le premier, TASK-036, ci-dessous) ; celui-ci
était un manque déjà connu et documenté (`docs/10-paiements.md`
§Facturation le listait explicitement), pas une découverte. Bouton
« Facture » dans l'historique passager (`apps/web`) pour chaque course
avec facture générée (`invoices`) — numéro, date, passager, chauffeur,
véhicule/plaque, trajet, distance, montants. `pdfSafe()` (le correctif
d'encodage jsPDF de TASK-036) extrait vers `apps/web/src/lib/pdf.ts`,
partagé entre les deux générateurs plutôt que dupliqué. Ne couvre pas
`apps/mobile` ni un futur écran d'historique de courses côté chauffeur
(n'existe pas encore).

**Toujours le 4 septembre 2026** — détail complet dans `docs/TASKS.md` (TASK-036) :
**reçu PDF d'abonnement chauffeur réellement construit** — découvert que
`docs/10-paiements.md` documentait ce reçu (`jsPDF`) comme déjà fait
depuis le tout début du projet alors qu'il n'existait nulle part dans le
code (vérifié : aucune occurrence de `jsPDF` dans le dépôt avant ce jour).
Construit pour de vrai : `apps/web/src/lib/receipt.ts`, section « Reçus »
dans le tableau de bord chauffeur, un bouton Télécharger par paiement
d'abonnement réussi. A aussi révélé un vrai bug au passage : les polices
standard de jsPDF ne rendent pas l'espace fine insécable qu'utilise le
formatage FCFA comme séparateur de milliers (montant affiché corrompu
dans le PDF) — repéré en relisant le contenu réel du fichier généré, pas
seulement en vérifiant qu'un PDF valide existait ; corrigé localement
dans `receipt.ts`. `jsPDF` embarque `html2canvas`+`dompurify` (~380 Ko
gzip, plugin `.html()` jamais utilisé) — chargé à la demande (`import()`
dynamique) plutôt que dans le chunk principal, pour ne pas alourdir le
chargement de tout le monde (passager compris) pour une fonctionnalité
chauffeur seule. Doc corrigée au passage (référençait aussi une route
`/abonnement` qui n'a jamais existé). Ne couvre pas la facture de course
(`invoices`, toujours sans rendu PDF, périmètre plus large) ni
`apps/mobile` (non porté, jsPDF nécessite une approche différente en
React Native).

**Toujours le 4 septembre 2026** — détail complet dans `docs/TASKS.md` (TASK-035) :
**position du chauffeur câblée sur les deux plateformes** — découvert en
vérifiant si `update_driver_location` (existante depuis la migration 2,
condition nécessaire au matching via `dispatch_next_offer`) était
réellement appelée : elle ne l'était nulle part, ni côté `apps/web` ni
côté `apps/mobile`. Sans cet appel le matching n'aurait jamais pu
fonctionner en production, indépendamment de la clé Google Maps ou des
tarifs. Corrigé : suivi de position en continu (foreground uniquement,
jamais d'arrière-plan) tant que le chauffeur est disponible, y compris
pendant une course. A aussi révélé et corrigé un vrai bug au passage :
le premier appel `supabase.rpc(...)` dans la callback de position
n'était ni `await` ni `.then()` — `supabase-js` expose un thenable
paresseux, la requête ne partait donc jamais avant correction. Un grep
systématique sur les trois apps a confirmé que c'était un cas isolé.
Vérifié via Playwright (`expo-location` a une vraie implémentation web,
contrairement à `Alert.alert`) : géolocalisation accordée → appel RPC
avec les bonnes coordonnées ; refusée → message d'erreur clair, aucun
appel. `tsc`/`oxlint` propres.

**Toujours le 4 septembre 2026** — détail complet dans `docs/TASKS.md` (TASK-034) :
**`apps/mobile` porté au même périmètre qu'`apps/web`** — tableau de bord
chauffeur (onboarding, documents via `expo-file-system`, abonnement,
disponibilité, offres, course en cours) et demande de course passager
(suivi, formulaire avec le nouveau composant `SelectField`, estimation,
historique), portage direct des mêmes RPC/Edge Function. Vérifié via le
mode web d'Expo + Playwright (aucun émulateur natif ici) : les deux
tableaux de bord de bout en bout sur les chemins non bloqués par
`Alert.alert` (no-op découvert sur ce mode de vérification, sans effet
sur le comportement natif réel). `tsc`/`oxlint` propres.

**Toujours le 4 septembre 2026** — détail complet dans `docs/TASKS.md`
(TASK-033) : **`apps/mobile` démarré** (Expo SDK 57 + TypeScript + Expo
Router) — accueil avec bascule de rôle, authentification par code email
passager/chauffeur (composant partagé, port direct de la logique
`apps/web`), gardes de session sur les 4 routes.

**Toujours le 4 septembre 2026** — détail complet dans `docs/TASKS.md`
(TASK-032) : **vrais tarifs câblés** — `pricing_rules` (voiture 250 FCFA prise en
charge + 250 FCFA/km, minimum 700 FCFA ; moto 100 FCFA prise en charge +
70 FCFA/km, pas de minimum ; majoration de nuit 10 % de 22h à 5h pour les
deux) et correction de `subscription_plans` (Pass Jour moto 500 → 300
FCFA, jamais confirmé avant). Corrigé au passage : la majoration de nuit
ne se déclenchait jamais sans zone sélectionnée (repli sur la fenêtre
22h-5h ajouté). Plus aucun tarif inventé ni manquant — la demande de
course ne dépend plus que de la clé Google Maps (§3/§7).

**Toujours le 4 septembre 2026** — détail complet dans `docs/TASKS.md`
(TASK-029 à TASK-031) : **côté chauffeur de `apps/web` construit** (auth, dépôt de
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

Le code applicatif (dashboard admin, `apps/web` et `apps/mobile`,
passager/chauffeur) est terminé pour le périmètre MVP documenté sur les
trois plateformes. Ce qui reste est soit externe (décisions/comptes qui
vous appartiennent, §7), soit une vérification que je ne peux pas faire
depuis cet environnement (rendu natif réel d'`apps/mobile` sur un
simulateur/appareil Android ou iOS, upload de document, les trois
confirmations `Alert.alert`). Aucun chantier de code n'est bloqué en
attente d'une décision technique de mon côté.

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
- **Tester `apps/mobile` sur votre téléphone** (optionnel, quand vous
  voulez) : `cd apps/mobile && npm install && npx expo start`, puis
  scanner le QR code avec l'app **Expo Go** (Android/iOS, gratuite) — pas
  besoin de compte Expo/EAS pour ça. C'est le seul moyen de vérifier le
  rendu natif réel et les trois confirmations `Alert.alert`, non
  testables depuis cet environnement (voir §3).
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
