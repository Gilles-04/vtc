# État du projet — VTC Togo

*Dernière mise à jour : 5 septembre 2026 (le porteur du projet a testé
`apps/web` en local pour la première fois — a validé le parcours de bout
en bout et fait remonter un vrai besoin : remplacer la saisie manuelle
de coordonnées par géolocalisation + carte (TASK-043), ce qui a aussi
révélé et corrigé deux bugs d'affichage réels de la carte ; avant ça,
audit honnête de tous les écrans documentés dans `docs/05-ecrans.md`
avait révélé 7 zones manquantes — SOS, signalement, fiabilité chauffeur
affichée, profil/paramètres, onboarding + profil initial passager,
facturation détail admin, carte live admin — toutes construites le jour
même (TASK-042) ; clé Google Maps câblée plus tôt dans la journée,
dernier blocage réel du parcours passager levé — détail des tâches dans
`docs/TASKS.md`)*

> Instantané, pas un journal — réécrit à chaque mise à jour significative.

## 1. Où en est-on ?

Le backend (schéma, logique métier, module financier complet, deux
catégories voiture/moto-taxi) est **déployé pour de vrai** sur le projet
Supabase dédié : 18 migrations + 5 Edge Functions en place et vérifiées
(32 tables, 52 fonctions, 51 policies RLS, grants internes durcis).
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

**Tous les écrans transverses et de sécurité manquants sont désormais
construits** (5 septembre 2026, TASK-042 dans `docs/TASKS.md`) : un audit
grep contre l'inventaire complet de `docs/05-ecrans.md` a trouvé 7 zones
réellement absentes malgré des mois de travail — SOS (passager +
chauffeur, web + mobile), Signalement (écran #14), fiabilité chauffeur
(`acceptance_rate`/`cancellation_rate`, calculés depuis TASK-039 mais
jamais montrés), Profil/Paramètres (transverse), Onboarding + Profil
initial passager (écrans #1/#4), Facturation — détail admin (écran #16)
et Carte live des courses admin (écran #10, Leaflet + OpenStreetMap).
Toutes construites et vérifiées (tsc/build/lint) le jour même — détail
complet en §5.

Reste à construire : l'autocomplétion d'adresse Google Places (§3, non
bloquant), notifications push et géolocalisation en arrière-plan côté
`apps/mobile` (hors périmètre porté ce jour), le worker de dispatch
dédié (écrit, pas déployé — comblé en attendant par un repli `pg_cron`,
voir §2 et §5).

## 2. Ce qui fonctionne

**Tous les écrans transverses/sécurité identifiés manquants sont
construits (5 septembre 2026, TASK-042)** :
- **SOS** — bouton transverse dans l'en-tête passager/chauffeur (`apps/web`
  et `apps/mobile`), confirmation puis géolocalisation ponctuelle,
  `trigger_sos` (migration 18) qui construit la position côté serveur
  plutôt qu'un insert direct sur une colonne `geography`.
- **Signalement** (écran #14) — catégorie + description, insert direct
  sur `reports` (RLS déjà permissive), depuis la course en cours ou
  l'historique, `apps/web` et `apps/mobile`.
- **Fiabilité chauffeur affichée** — `acceptance_rate`/`cancellation_rate`
  (calculés depuis TASK-039) enfin visibles sur le tableau de bord
  chauffeur.
- **Profil/Paramètres** — édition nom/langue (`profiles`), accessible
  même avant approbation du dossier chauffeur, `apps/web` et `apps/mobile`.
- **Onboarding + Profil initial passager** (écrans #1/#4) — écran
  d'accueil avant la saisie email ; capture nom/langue après le tout
  premier code vérifié, seulement pour un compte encore sans nom.
- **Admin Facturation — détail** (écran #16, `/facturation/$invoiceId`).
- **Admin Carte live des courses** (écran #10, `/carte`) — Leaflet +
  OpenStreetMap (pas de clé Google Maps pour `apps/admin`, usage interne
  staff), s'appuie sur `admin_active_rides_locations()` (migration 18).

**Base de données** (18 migrations, vérifiées en local puis déployées,
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

**Clé Google Maps obtenue et câblée (5 septembre 2026)** — dernier
blocage réel du parcours passager. Deux clés créées séparément (voir
`.env.example` racine) : clé serveur (`GOOGLE_MAPS_API_KEY`, Directions
API uniquement, aucune restriction de referrer, secret Supabase Edge
Function) et clé client (`VITE_GOOGLE_MAPS_API_KEY`/
`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, Places API (New) + Maps JavaScript
API, restreinte par referrer HTTP). **Vérifié en conditions réelles**,
pas seulement supposé configuré : appel direct de l'Edge Function
`pricing-directions` via `net.http_post` (le sandbox ne peut toujours
pas contacter `*.supabase.co` directement) — réponse `HTTP 200` avec de
vraies données Google Directions (`distance_km`, `duration_min`) puis
tarif calculé correctement par `estimate_ride_fare` (tarif minimum
voiture 700 FCFA appliqué quand le calcul au km tombe en dessous).
L'estimation/demande de course fonctionne désormais de bout en bout.
Reste à construire (pas bloquant, saisie manuelle des coordonnées en
attendant, §3) : l'autocomplétion d'adresse avec la clé client.

**`apps/mobile` complet côté code, même périmètre qu'`apps/web`** : voir
§1. Rendu natif réel non vérifié dans cet environnement (§3).

**`pg_cron` réellement actif sur le projet réel** — découvert en
déployant la migration 16 que l'extension n'avait jamais été installée :
`expire_subscriptions` et `cleanup_rate_limits` (en place depuis le tout
début du projet) n'avaient donc **jamais tourné automatiquement en
production**, malgré le `do $$ if exists(pg_extension pg_cron)... $$`
qui masquait le problème sans erreur. Corrigé : extension installée, les
trois tâches (les deux existantes + `recompute-driver-reliability`,
ci-dessous) programmées et vérifiées en train de tourner
(`cron.job_run_details`, pas seulement `cron.job`). Aucun effet de bord
au moment de l'activation (1 seul abonnement en base, non expiré ; 0
ligne obsolète dans `rate_limit_counters`).

**Le matching ne bloque plus indéfiniment sur un chauffeur muet** —
découverte plus grave en creusant le sujet `pg_cron` ci-dessus : le
worker dédié (`services/matching-worker/`) qui relance le dispatch
quand une offre expire sans réponse (15 s) n'a **jamais été déployé**
(aucun VPS choisi pour ce projet). Sans lui, une course dont le chauffeur
assigné ne répond jamais restait bloquée en `'searching'` pour toujours.
Vérifié directement contre le projet réel — contrairement à ce que
`services/matching-worker/README.md` affirmait — que `pg_cron` accepte
un intervalle en secondes, pas seulement la minute : `expire_ride_offers_and_dispatch()`
y est désormais planifiée toutes les 5 s (migration
`00000000000017_interim_cron_offer_sweep.sql`, confirmé avec le porteur
du projet avant activation). Solution de repli, pas un remplacement — le
worker dédié reste la solution prévue une fois un serveur choisi ; les
deux peuvent tourner en parallèle sans risque le jour venu
(`for update skip locked`).

**Critère de fiabilité du matching** (`docs/08-matching.md`, migration
16) — `drivers.acceptance_rate`/`cancellation_rate`, recalculés toutes
les 15 min (`pg_cron`), intégrés au classement de `dispatch_next_offer`
juste après la distance. Demandé explicitement par le porteur du projet
(documenté jusque-là comme non fait au MVP).

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

- **Carte live admin (`/carte`) non vérifiée avec de vraies données** —
  navigation réelle confirmée (Chromium headless, route/auth guard OK,
  aucune erreur JS), mais le rendu de la carte avec des marqueurs réels
  n'a pas pu être vérifié : pas de mot de passe admin utilisable, réseau
  sandbox bloqué vers `*.supabase.co` (même limitation que la connexion
  admin ci-dessous, pas un problème propre à cet écran).
- **Facturation détail (`/facturation/$id`) non vérifiable sur une vraie
  facture** — code/route corrects (tsc/build propres, même schéma de
  requête que les écrans détail existants), mais aucune facture n'existe
  encore en production (aucune course payée terminée à ce jour).
- **`apps/mobile` toujours en saisie manuelle de coordonnées** — le
  sélecteur géolocalisation + carte (TASK-043) ne couvre que `apps/web`
  pour l'instant. Pas bloquant : la demande de course fonctionne déjà de
  bout en bout côté mobile avec cette saisie manuelle.
- **Auto-complétion d'adresse (Google Places) délibérément pas
  construite** (TASK-043) — la clé client le permettrait, mais la
  compatibilité du composant `Autocomplete` historique avec une clé
  restreinte à « Places API (New) » n'est pas garantie, et beaucoup de
  lieux au Togo ne sont pas indexés de toute façon. Remplacé par
  géolocalisation + carte, qui répond mieux au besoin réel.
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
- **Mobile Money** : fournisseur non choisi (§7) — non bloquant, backend
  en mode manuel/admin.
- **Protection mots de passe compromis (HaveIBeenPwned) désactivée** —
  interrupteur dashboard (Authentication → Password protection), pas une
  migration. Deux minutes, quand vous voulez.

## 4. En cours

Rien en cours — en attente de la prochaine demande.

## 5. Dernièrement terminé

**5 septembre 2026** — détail complet dans `docs/TASKS.md` (TASK-043) :
**sélecteur géolocalisation + carte pour la demande de course**
(`apps/web`). Premier test réel du porteur du projet sur `apps/web` en
local — a fait remonter que la saisie manuelle de coordonnées ne
correspond pas à la réalité togolaise (adresses/coordonnées peu
maîtrisées). `LocationPicker` : bouton « Ma position », carte Google Maps
avec repère déplaçable, remplace les champs latitude/longitude de
`PassengerHome.tsx`. Deux bugs d'affichage réels trouvés et corrigés
grâce à ses captures d'écran (carte réduite à une vignette minuscule —
cause réelle : le reset Tailwind sur `<img>` s'appliquait aux tuiles
Google Maps, corrigé par `.gm-style img { max-width: none }`), aucun des
deux non détectable depuis ce sandbox (accès direct à
`maps.googleapis.com` bloqué par la politique réseau). Ne couvre que
`apps/web` — `apps/mobile` reste en saisie manuelle.

**5 septembre 2026** — détail complet dans `docs/TASKS.md` (TASK-042) :
**les 7 écrans/zones manquants identifiés par un audit honnête sont
construits.** Demande explicite du porteur du projet après avoir demandé
« as-tu fait toutes les interfaces ? » — réponse honnête (grep sur le
code réel contre l'inventaire de `docs/05-ecrans.md`, pas la mémoire)
révélant SOS et Signalement entièrement absents malgré des mois de
travail, la fiabilité chauffeur calculée mais jamais affichée, aucun
écran Profil/Paramètres, aucune capture de nom à l'inscription passager,
et deux écrans admin jamais construits (Facturation détail, Carte live).
Tout construit le jour même, un commit par sous-partie :
- **SOS** : migration 18 (`trigger_sos`, `admin_active_rides_locations`)
  appliquée au projet réel et revérifiée (grants réels, pas
  `{"success":true}`) ; bouton transverse web + mobile, passager +
  chauffeur, confirmation puis géolocalisation ponctuelle.
- **Signalement** (écran #14) : formulaire catégorie + description sur
  `reports`, web + mobile.
- **Fiabilité chauffeur** : `acceptance_rate`/`cancellation_rate` enfin
  affichés sur le tableau de bord chauffeur.
- **Profil/Paramètres** : édition nom/langue, web + mobile.
- **Onboarding + Profil initial passager** (écrans #1/#4) : écran
  d'accueil + capture nom/langue pour un tout nouveau compte uniquement.
- **Admin Facturation détail** (écran #16) : `/facturation/$invoiceId`.
- **Admin Carte live des courses** (écran #10) : `/carte`, Leaflet +
  OpenStreetMap (pas de clé Google Maps configurée pour `apps/admin`,
  usage interne staff).
Vérifié : tsc/build/lint propres sur les trois apps après chaque
sous-partie ; migration revérifiée directement contre le projet réel ;
navigation réelle vers `/carte` en Chromium headless. Non vérifiable
depuis ce sandbox (limitations déjà connues, pas nouvelles) : rendu de
la carte avec de vraies données, facturation détail sur une vraie
facture (§3). `trigger_sos` volontairement pas appelée pour de vrai en
production (déclencherait une vraie alerte au staff).

**5 septembre 2026** — détail complet dans `docs/TASKS.md` (TASK-041) :
**clé Google Maps obtenue et câblée, dernier blocage réel du parcours
passager levé.** Le porteur du projet a créé les deux clés dans Google
Cloud Console (guidé pas à pas, captures d'écran à l'appui) : clé
serveur (Directions API, sans restriction de referrer) et clé client
(Places API (New) + Maps JavaScript API, restreinte par referrer). Clé
client mise en place directement (`apps/web/.env`, `apps/mobile/.env`,
jamais commitée — vérifié) ; clé serveur transmise pour configuration en
secret Supabase (aucun outil MCP ne permet de gérer les secrets Edge
Function, seul le porteur du projet peut le faire depuis le Dashboard).
**Vérifié en conditions réelles**, pas seulement supposé configuré :
`pricing-directions` appelée via `net.http_post` depuis la base (le
sandbox ne peut pas contacter `*.supabase.co` directement) — `HTTP 200`,
vraies données Google Directions, tarif calculé correctement (minimum
voiture 700 FCFA appliqué). L'estimation/demande de course fonctionne
désormais de bout en bout avec de vraies données. Reste à construire,
non bloquant : l'autocomplétion d'adresse (Google Places) côté
formulaire, actuellement une saisie manuelle des coordonnées.

**Toujours le 4 septembre 2026** — détail complet dans `docs/TASKS.md` (TASK-040) :
**le matching ne peut plus rester bloqué indéfiniment sur un chauffeur
muet** — découvert en creusant le fonctionnement réel de `pg_cron`
(TASK-039, juste en dessous) : `services/matching-worker/` (censé
relancer le dispatch quand une offre expire sans réponse) n'a jamais été
déployé, faute de VPS choisi pour ce projet. Sans lui, une course dont le
chauffeur assigné ne répondait jamais restait bloquée en `'searching'`
pour toujours — un vrai trou de production, pas un manque de finition.
`services/matching-worker/README.md` affirmait `pg_cron` incapable de
descendre sous la minute — vérifié directement contre le projet réel
que c'est faux (`cron.schedule(name, '5 seconds', ...)`, confirmé par
plusieurs exécutions consécutives espacées de 5 s pile dans
`cron.job_run_details`). Confirmé avec le porteur du projet avant
d'agir (`AskUserQuestion` — programmer une tâche pg_cron supplémentaire
en production dépassait le périmètre de la tâche en cours) : migration
`00000000000017_interim_cron_offer_sweep.sql` planifie désormais
`expire_ride_offers_and_dispatch()` toutes les 5 s. Solution de repli,
pas un remplacement — le worker dédié reste la solution prévue une fois
un serveur choisi ; les deux peuvent tourner en parallèle sans risque
(`for update skip locked`). Doc corrigée (`08-matching.md`,
`services/matching-worker/README.md`, `docs/STATUS.md`).

**Toujours le 4 septembre 2026** — détail complet dans `docs/TASKS.md` (TASK-039) :
**critère de fiabilité du matching construit, `pg_cron` réellement activé
en production** — demandé explicitement par le porteur du projet
(`docs/08-matching.md` le documentait comme non fait au MVP). Migration
16 : `drivers.acceptance_rate`/`cancellation_rate` (fenêtre glissante
30 jours, `null` sans donnée récente — jamais pénalisant), recalculés par
`recompute_driver_reliability()` (`pg_cron`, toutes les 15 min),
intégrés au classement de `dispatch_next_offer` juste après la distance.
Vérifié en local (Postgres réel, deux chauffeurs à distance identique —
fiable systématiquement préféré au peu fiable ; un chauffeur sans
historique départagé équitablement par la note) avant application au
projet réel via MCP. **Découverte significative en vérifiant le
déploiement** (pas seulement `{"success":true}`) : `pg_cron` n'était
jamais installé sur le projet réel — `expire_subscriptions`/
`cleanup_rate_limits` (en place depuis le tout début du projet)
n'avaient donc jamais tourné automatiquement, sans qu'aucune erreur ne
le signale (le garde `if exists(pg_extension pg_cron)` masquait le
problème). Confirmé avec l'utilisateur avant d'agir (activer une
extension puis programmer des tâches qui modifient des données réelles
en production dépasse le périmètre demandé) — il a choisi d'activer les
trois tâches. Aucun effet de bord au moment de l'activation (vérifié
avant : 1 seul abonnement en base, non expiré) ; `expire-subscriptions`
confirmé réellement exécuté avec succès dans `cron.job_run_details`, pas
seulement programmé dans `cron.job`.

**Toujours le 4 septembre 2026** — détail complet dans `docs/TASKS.md` (TASK-038) :
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
trois plateformes, écrans transverses/sécurité inclus (TASK-042). Seule
pièce visuelle non construite, non bloquante : l'autocomplétion d'adresse
Google Places (§3). « Moyens de paiement » (écran transverse listé dans
`docs/05-ecrans.md`) reste délibérément non construit : aucun moyen de
paiement n'est enregistré dans ce système, le mode est choisi à chaque
course — pas de quoi construire un écran tant que cette conception ne
change pas.

Ce qui reste est soit externe (décisions/comptes qui vous appartiennent,
§7), soit une vérification que je ne peux pas faire depuis cet
environnement (rendu natif réel d'`apps/mobile` sur un simulateur/appareil
Android ou iOS, upload de document, les trois confirmations `Alert.alert`,
rendu réel de la carte live et de la facturation détail sur des données
réelles, §3). Aucun chantier de code n'est bloqué en attente d'une
décision technique de mon côté.

## 7. Décision(s) / action(s) requise(s) de votre part

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
