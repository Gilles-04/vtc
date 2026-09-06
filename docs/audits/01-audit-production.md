# Audit 1/12 — Production, fonctionnalité et mise en ligne

*Réalisé le 6 septembre 2026. Pipeline d'audits demandé par Gilles (voir
`docs/audits/00-pipeline.md`). Méthode : lecture directe du code, des 18
migrations, interrogation réelle du projet Supabase distant via les outils
MCP (tables, migrations appliquées, advisors sécurité/performance,
extensions), `npm audit`, `npm run verify`. Aucune donnée inventée —
chaque affirmation est marquée **CONFIRMÉ** (vérifié directement),
**INFÉRÉ** (déduction raisonnable), ou **NON VÉRIFIABLE** (nécessite un
accès que cet environnement n'a pas), avec la raison.*

---

## Réponse directe à la question posée

> « Si je mets ce site en ligne aujourd'hui, qu'est-ce qui fonctionne
> réellement, qu'est-ce qui casse, qu'est-ce qui est incomplet ? »

Le **backend est réellement fonctionnel** (32 tables, RLS partout, 51
fonctions métier, 5 Edge Functions actives, `pg_cron` actif) et **les 3
applications compilent, se construisent et ont été vérifiées par rendu
réel** (Playwright/Chromium avec mocks, jamais contre le vrai réseau).
Mais **rien n'est aujourd'hui accessible à un vrai utilisateur** : aucune
des 3 apps n'a d'URL publique confirmée fonctionnelle (déploiement
Vercel en cours, non validé), il n'existe **aucun test automatisé**
(0 fichier de test dans tout le dépôt), et deux zones n'ont **jamais été
vérifiées en conditions réelles** : `apps/mobile` sur un vrai
téléphone, et le paiement Mobile Money avec un vrai fournisseur (aucun
choisi).

**Verdict de cet audit : 🟠 NOT READY** — voir §23.

---

## 1. Reconstruction du produit et carte d'architecture

**CONFIRMÉ** (lecture de `docs/01-architecture-fonctionnelle.md`,
`docs/02-architecture-technique.md`, code) :

```text
Passager / Chauffeur (navigateur ou app Expo)
   ↓
apps/web (React 19 + Vite + TanStack Router)   — pas encore déployé publiquement
apps/mobile (Expo/React Native, Android+iOS)   — jamais lancé hors sandbox web
   ↓ (HTTPS direct, PostgREST + RPC + Realtime + Storage)
Supabase Cloud — projet elrsjctwrvzglwogmmpq (région eu-west-1, Postgres 17.6.1)
   ├── Auth (code email, pas de mot de passe)
   ├── Postgres (32 tables, RLS sur toutes) + PostGIS
   ├── 51 fonctions SECURITY DEFINER (RPC métier + admin)
   ├── 5 Edge Functions Deno
   ├── Storage (bucket `driver-documents`)
   ├── Realtime (offres de course, statut de course)
   └── pg_cron (balayage des offres expirées, interim)
   ↑
apps/admin (React 19 + Vite) — équipe interne, pas encore déployé publiquement
```

Il n'y a **pas de backend applicatif séparé** (pas de Node/Express, pas de
VPS pour ce projet) — toute la logique métier vit dans Postgres
(fonctions `SECURITY DEFINER`) ou dans les 5 Edge Functions. **Aucun
CDN, aucun reverse proxy, aucun domaine personnalisé** ne sont configurés
à ce jour (voir §15).

**INFÉRÉ** : un VPS existe (mentionné dans
`supabase/migrations/00000000000017_interim_cron_offer_sweep.sql`,
commentaire : « le VPS existant sert un autre projet du porteur du
projet ») mais n'héberge **rien pour VTC Togo** — confirme que l'audit
« Hardening VPS » (pipeline étape 8) sera **non applicable** à ce
projet dans son état actuel.

---

## 2. Inventaire complet du dépôt

| Élément | Présent | Utilisé | Fonctionnel | Critique | État |
|---|:-:|:-:|:-:|:-:|---|
| `apps/web` | ✅ | ✅ | ✅ (vérifié Playwright) | ✅ | Code complet, jamais déployé publiquement |
| `apps/admin` | ✅ | ✅ | ✅ (vérifié Playwright) | ✅ | Idem |
| `apps/mobile` | ✅ | ✅ | ⚠️ (mode web seulement) | ✅ | Jamais lancé sur émulateur/téléphone réel |
| `supabase/migrations` (18 fichiers) | ✅ | ✅ | ✅ | ✅ | **Désynchronisé de l'état distant réel — voir §9.5** |
| `supabase/functions` (5 Edge Functions) | ✅ | ✅ | ✅ (déployées, `ACTIVE`) | ✅ | `push-notifications-dispatch` vérifiée bout en bout, les 4 autres jamais rejouées en conditions réelles |
| `services/matching-worker` | ✅ | ❌ | ⚠️ | ⚠️ | Écrit, testé en local, **jamais déployé** (voir §1) |
| `.github/workflows/ci.yml` | ✅ | ✅ | ✅ | ⚠️ | Vérifie tsc/build/lint uniquement — aucun test, aucun scan sécurité |
| Tests (unitaires/intégration/E2E) | ❌ | — | — | 🔴 | **0 fichier de test dans tout le dépôt** (confirmé, voir §19) |
| Docker / VPS pour ce projet | ❌ | — | — | — | Non applicable (voir §1) |
| Domaine personnalisé | ❌ | — | — | ⚠️ | Aucun DNS à auditer (voir §15) |
| `vercel.json` (web + admin) | ✅ | ✅ | ❓ | 🔴 | Rewrite SPA présent, déploiement non confirmé fonctionnel (TASK-053) |

---

## 3. Cartographie des fonctionnalités

Détail complet et daté de chaque fonctionnalité construite :
`docs/CHANGELOG.md` (TASK-001 à TASK-052). Classification :

### CORE (indispensable au produit) — toutes **construites et vérifiées par rendu réel (mocks)**
Auth par code email, demande de course (géoloc + carte + estimation
tarif réel via Edge Function), matching avec critère de fiabilité,
abonnement chauffeur (achat/expiration), suivi de course temps réel,
paiement (cash + Mobile Money mode manuel admin), facturation
automatique (trigger SQL), dashboard admin (24 écrans).

### IMPORTANT — construites et vérifiées
Notation post-course, notifications in-app, support client, SOS,
signalement, anti-fraude (appareil partagé, anomalie GPS, limitation de
débit — **câblée mais jamais réellement déclenchée en conditions
réelles**, voir TASK-092).

### SECONDARY — construites, non prioritaires
Reçus/factures PDF, profil/paramètres, carte live admin.

### FUTURE (scaffolding préparé, volontairement non construit)
- `promotions`/`promotion_redemptions` : tables et fonction
  `validate_promo_code` existent, aucun écran de création de promo côté
  admin (documenté dans `docs/03-sitemap.md` comme « préparé, non
  actif »).
- `passengers.referral_code`/`referred_by` : généré automatiquement à
  l'inscription, **aucune logique de récompense** ni écran associé
  (trouvé et documenté en TASK-050 — décision volontaire, pas un oubli).
- `services/matching-worker` : remplacé par un balayage `pg_cron`
  interimaire (voir §1).

Aucune fonctionnalité documentée comme « terminée » dans le CHANGELOG
n'a été trouvée réellement absente du code — **cohérence
documentation ↔ code CONFIRMÉE** sur les 52 tâches revues.

---

## 4. Parcours utilisateurs — état de vérification réel

| Parcours | Vérifié par rendu réel | Méthode | Limite connue |
|---|:-:|---|---|
| Passager : inscription → demande de course → suivi → fin → notation | ✅ | Playwright + mocks REST/RPC (`apps/web`) | Jamais contre le vrai Supabase (réseau bloqué depuis ce sandbox) |
| Chauffeur : dossier KYC → abonnement → dispo → offre → course → revenus | ✅ | Playwright + mocks (`apps/web` et `apps/mobile` en mode web) | Idem + `Alert.alert` (mobile) est un no-op en mode web : achat abonnement, paiement cash, annulation **jamais vérifiés sur mobile** |
| Admin : connexion → décision KYC → paiement → règlement | ✅ | Playwright + mocks (`apps/admin`) | Compte admin (`abotchigilles@yahoo.fr`) créé comme passager, **mot de passe probablement inutilisable** — `/login` jamais confirmé fonctionnel avec de vraies données |
| Paiement Mobile Money bout en bout (webhook réel) | ❌ | — | Aucun fournisseur Mobile Money choisi ; `payment-webhook-momo` déployée mais jamais appelée par un vrai fournisseur |
| Notification push reçue sur un vrai téléphone | ❌ | — | Aucun projet Expo/EAS créé (bloquant technique, pas seulement non testé) |

---

## 5. Frontend — analyse

- **Routing** : TanStack Router (web/admin), Expo Router (mobile) —
  gardes de session vérifiées (`beforeLoad` redirige si pas de session).
- **États loading/empty/error** : présents sur les écrans audités
  (`Chargement…`, messages d'erreur inline) — pas de revue exhaustive
  écran par écran dans cet audit (couvert par l'audit UX/UI, pipeline
  étape 7).
- **Taille de bundle** : `apps/web` et `apps/admin` produisent chacun un
  chunk `index-*.js` > 500 kB minifié (avertissement Vite à chaque
  build, **CONFIRMÉ** par `npm run verify`) — jsPDF/html2canvas chargés
  en dynamique (`import()`) pour les reçus/factures, mais le chunk
  principal reste volumineux (React 19 + Supabase JS + TanStack Router +
  Google Maps loader). Non bloquant pour le lancement, à traiter dans
  l'audit performance (pipeline étape 6).
- **Responsive/mobile** : Tailwind avec classes responsive dans le code
  observé ; **non vérifié sur de vrais appareils** (audit UX/UI à
  suivre).
- **Aucun composant ni import mort détecté** lors des découpages de
  fichiers de la TASK-052 (vérification tsc/lint systématique).

---

## 6. Backend / API — analyse

Ce projet n'a **pas d'API REST custom** : le frontend appelle directement
PostgREST (tables avec RLS) et **51 fonctions RPC** `SECURITY DEFINER`
plus **5 Edge Functions**. Inventaire réel (via `list_edge_functions`) :

| Edge Function | Statut | `verify_jwt` | Vérifiée en conditions réelles |
|---|---|:-:|:-:|
| `pricing-directions` | ACTIVE | ✅ | ⚠️ Jamais (dépend de `maps.googleapis.com`, bloqué depuis ce sandbox) |
| `payment-webhook-momo` | ACTIVE | ✅ | ❌ Jamais (aucun fournisseur configuré) |
| `phone-verification-start` / `-check` | ACTIVE | ✅ | ❌ Circuit eSMS Africa abandonné (voir `docs/DECISIONS.md`) — code conservé en réserve |
| `push-notifications-dispatch` | ACTIVE | ✅ | ✅ Bout en bout (notification de test → appel HTTP confirmé, TASK-089) |

**Point d'attention réel (non un bug)** : `pricing-directions` et
`phone-verification-*` ont `verify_jwt: true`, ce qui est correct pour
des fonctions appelées par un utilisateur authentifié — mais
`phone-verification-*` n'est plus appelée par aucun code frontend
(circuit abandonné) : elles restent déployées et exposées sans être
mortes fonctionnellement dangereuses (JWT requis), simplement inutiles
aujourd'hui.

Les 51 fonctions RPC sont crées avec `SECURITY DEFINER` — cohérent avec
la convention du projet (`search_path` explicite systématique, vérifié
dans les migrations). Deux d'entre elles
(`get_ride_driver_public_info`, `get_ride_passenger_public_info`) sont
exécutables par le rôle `anon` (non authentifié) — signalé par les
advisors Supabase (**WARN**), à creuser dans l'audit sécurité dédié
(pipeline étape 2/3), pas traité ici pour éviter la duplication.

---

## 7. Base de données

**CONFIRMÉ** (interrogation directe du projet distant) :

- **32 tables dans `public`, RLS activée sur les 32** (aucune table
  publique sans RLS — bon signal, à re-vérifier en détail dans l'audit
  Supabase dédié).
- Le schéma correspond à ce que le frontend attend : aucune divergence
  de type détectée lors des vérifications Playwright (les mocks REST ont
  été construits à partir des `select()` réels du code, donc toute
  divergence de colonne aurait cassé le rendu — aucune trouvée).
- **Volumétrie actuelle** (données de test/développement) : 6 profils, 3
  chauffeurs, 5 courses, 1 abonnement actif — cohérent avec un projet en
  développement, pas de données de production réelles.

### 7.1 Migrations : désynchronisation confirmée avec le projet distant

**CONFIRMÉ, finding nouveau non documenté avant cet audit.**

Le dossier local `supabase/migrations/` contient **18 fichiers** nommés
`00000000000001_...` à `00000000000018_...` (numérotation séquentielle
artificielle, **pas** le format d'horodatage standard généré par
`supabase migration new`). L'historique réellement appliqué sur le
projet distant (`list_migrations`) ne contient que **14 entrées**,
horodatées au format standard (`20260903160222`, etc.) :

- Les migrations locales **1 à 7** (schéma initial, logique métier,
  vérification téléphone, jetons push, trigger notifications, storage
  documents chauffeur) **n'apparaissent pas** dans l'historique de
  suivi distant — cohérent avec la pratique documentée dans
  `CLAUDE.md` (« Le SQL Editor de Supabase a une limite de collage… »)
  : ces migrations ont été **collées à la main** dans le SQL Editor,
  jamais appliquées via `supabase db push`, donc jamais enregistrées
  dans la table de suivi `supabase_migrations.schema_migrations`.
- **Deux migrations existent côté distant sans fichier local
  correspondant** : `revoke_internal_function_grants_v2` et
  `support_tickets_profile_embed_fk` (cette dernière est la migration
  **la plus récente** appliquée, le 5 septembre à 17h51 — postérieure à
  toutes les migrations locales).
- Une migration distante (`enable_pg_cron_and_schedule_jobs`,
  appliquée entre les fichiers locaux 16 et 17) ne correspond à aucun
  fichier local dédié — son contenu (activation de l'extension
  `pg_cron`) est probablement inclus silencieusement dans un autre
  fichier ou a été appliqué séparément sans être reversé dans le dépôt.

**Impact réel** : `supabase/migrations/` n'est **plus une source de
vérité fiable à 100 %**. Si quelqu'un rejoue ces 18 fichiers sur un
nouveau projet Supabase vierge (`supabase db push`), le résultat ne
reproduira **pas exactement** l'état actuel du projet de production —
au minimum la correction d'embedding PostgREST sur `support_tickets`
manquera. C'est exactement le scénario que `docs/22-DEPLOIEMENT` (audit
pipeline étape 12) doit pouvoir garantir et qui échouerait aujourd'hui.

**Action recommandée** (technique, réversible) : générer un dump du
schéma réel (`supabase db dump` ou équivalent) et créer un fichier
`00000000000019_reconciliation_schema.sql` capturant l'écart exact, ou
a minima documenter dans `docs/06-schema-base-donnees.md` que le
dossier de migrations est incomplet vis-à-vis de l'état réel. Non fait
dans cet audit (changement de données de production, nécessite votre
accord — voir règle d'autonomie de `CLAUDE.md`).

---

## 8. Supabase — état réel du projet

| Élément | État |
|---|---|
| Projet | `elrsjctwrvzglwogmmpq`, région `eu-west-1`, `ACTIVE_HEALTHY` |
| Postgres | 17.6.1 (canal GA) |
| Tables | 32, RLS activée partout |
| Fonctions RPC exposées | 51 (voir advisors §17.1 — audit sécurité dédié) |
| Edge Functions | 5, toutes `ACTIVE` |
| `pg_cron` | Activé, job de balayage des offres actif (voir §7.1) |
| Storage | 1 bucket (`driver-documents`) |
| Auth | Code email, **pas de mot de passe** — protection mots de passe compromis (HaveIBeenPwned) **désactivée** (advisor WARN, 2 minutes à activer dans le Dashboard) |
| Migrations locales ↔ distant | **Désynchronisées**, voir §7.1 |

---

## 9. Services externes — inventaire

| Service | Usage | Credential nécessaire | Configuré | État |
|---|---|---|:-:|---|
| Supabase | Backend complet | URL + clé publique par app | ✅ | Actif |
| Vercel | Hébergement web + admin | Compte + projet | ⚠️ En cours | Non confirmé fonctionnel (TASK-053) |
| Google Maps Platform | Géolocalisation, carte, tarification | Clé API client + serveur | ✅ (clés en `.env`, non vérifiées depuis ce sandbox) | `maps.googleapis.com` bloqué par la politique réseau du sandbox — non vérifiable ici |
| Mobile Money (Flooz/TMoney/Semoa) | Paiement réel | Aucun choisi | ❌ | Bloquant business, pas technique |
| Expo/EAS | Notifications push, build mobile | Compte à créer | ❌ | Bloquant pour les notifications push réelles |
| eSMS Africa | SMS OTP | — | ❌ Abandonné | Code conservé en réserve (voir `docs/DECISIONS.md`) |

---

## 10. Environnements

**CONFIRMÉ** : un seul environnement réel existe — le projet Supabase
`elrsjctwrvzglwogmmpq` sert à la fois de développement et de future
production (**pas de séparation dev/staging/prod**). C'est un choix
raisonnable à ce stade (équipe d'une personne, pré-lancement) mais à
documenter explicitement comme risque : toute erreur de migration ou de
test manuel touche directement les données qui deviendront celles de
production.

---

## 11. Variables d'environnement

Inventaire exhaustif par app (fichiers `.env.example`, aucune valeur
réelle lue) :

| Variable | App(s) | Obligatoire | Sensible | Rôle |
|---|---|:-:|:-:|---|
| `VITE_SUPABASE_URL` | web, admin | ✅ | Non (publique) | URL du projet |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | web, admin | ✅ | Non (publique, RLS protège) | Clé anon |
| `VITE_GOOGLE_MAPS_API_KEY` | web, admin | ✅ | Restreinte HTTP referrer, pas secrète en soi | Carte + Places |
| `EXPO_PUBLIC_SUPABASE_URL` / `_PUBLISHABLE_KEY` | mobile | ✅ | Non | Idem web |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | mobile | ✅ | Restreinte | Idem |
| `EXPO_PUBLIC_PROJECT_ID` | mobile | ⚠️ (requis pour push) | Non | Identifiant Expo/EAS — **absent tant qu'aucun projet Expo n'est créé** |
| `GOOGLE_MAPS_API_KEY` (serveur) | Edge Function `pricing-directions` | ✅ | **Oui, secrète** | Directions API |
| `ESMS_AFRICA_API_KEY` | Edge Functions téléphone | ❌ (circuit abandonné) | Oui | Conservée en réserve |

**CONFIRMÉ** : `.env` correctement ignoré par git dans les 3 apps
(vérifié `git check-ignore`), aucun `.env` n'a jamais été commité
(`git log --all -- "*.env"` vide), aucun secret trouvé en clair dans le
code source (`grep` ciblé sur les motifs de clés connus, résultat vide).

---

## 12. Build et déploiement

**CONFIRMÉ, testé dans cet audit** :

```sh
npm run verify   # web + admin + mobile — exit 0, seuls des avertissements oxlint pré-existants
```

`tsc --noEmit`, `vite build` (web/admin), `oxlint` (3 apps) passent
tous. Le build réussit **même sans variable d'environnement présente**
(vérifié en TASK-053 précédente) — donc un CI vert ne prouve pas que les
clés sont correctement configurées côté hébergeur.

`npm audit --omit=dev` : **13 vulnérabilités, sévérité modérée
uniquement**, toutes dans l'outillage de build Expo (`@expo/cli` et
dépendances, catégorie `xcode`/config-plugins) — aucune dans le code
runtime livré aux utilisateurs, aucune haute/critique.

---

## 13. Deployment readiness

| Élément | État |
|---|:-:|
| `vercel.json` (web, admin) | ✅ présent (rewrite SPA) |
| Déploiement confirmé fonctionnel | ❌ TASK-053 en cours, non validé |
| HTTPS | Automatique via Vercel une fois déployé (non vérifié) |
| Process manager / healthcheck | Non applicable (Vercel gère) |
| Migrations en production | Déjà appliquées sur le projet Supabase réel (§7.1 nuance) |
| Secrets en production | À saisir dans Vercel (variables d'environnement) — confusion déjà rencontrée entre type « Secret » et « Plaintext » (voir `docs/STATUS.md` historique) |

**Peut-on déployer avec les fichiers actuels ?** Techniquement oui
(build + rewrite prêts), mais **la confirmation qu'un site chargé
fonctionne réellement n'a jamais été obtenue** — TASK-053 reste ouverte.

---

## 14. Domaine / DNS

**Non applicable actuellement** — **CONFIRMÉ** : aucune référence à un
nom de domaine personnalisé dans le dépôt (`grep` sur les fichiers de
doc/config, aucun résultat hors `vercel.app`/`supabase.co`). Les 3 apps,
une fois déployées, vivront sur des sous-domaines `*.vercel.app` tant
qu'aucun domaine n'est acheté. Rien à auditer ici avant cette décision.

---

## 15. Production / opérationnel

- **Démarrage/arrêt/redémarrage** : géré par Vercel (frontend) et
  Supabase Cloud (backend) — pas de service à administrer manuellement,
  **une fois le déploiement confirmé**.
- **Sauvegardes** : gérées par Supabase Cloud selon le plan
  d'abonnement — **non vérifié quel plan est actif ni la fréquence
  réelle des sauvegardes automatiques** (nécessite le Dashboard
  Supabase, voir audit pipeline étape 9).
- **Rollback** : `git revert` + redéploiement pour le frontend ; pour la
  base, **aucune procédure de restauration n'a jamais été testée** dans
  ce projet.

---

## 16. Performance — données réelles (Supabase Advisors)

**CONFIRMÉ**, extrait des advisors performance du projet réel :

- **42 clés étrangères sans index de couverture** (ex. `invoices.driver_id`,
  `invoices.passenger_id`, `payments.user_id`, `support_tickets.*`,
  `reports.*`, `sos_alerts.*` — liste complète disponible sur demande).
  Impact réel aujourd'hui : négligeable (volumétrie de test), mais
  deviendra un vrai problème de performance sur les jointures
  fréquentes (historique de courses, facturation) dès que le volume de
  données augmentera. **Correction simple et sans risque** (ajout
  d'index, `CONCURRENTLY` en production) — bon candidat pour l'audit
  performance dédié (pipeline étape 6).
- **36 policies RLS avec `auth.uid()` réévalué ligne par ligne**
  (`auth_rls_initplan`) — déjà documenté dans `docs/STATUS.md`, connu
  depuis la première migration, sans impact au volume actuel.
- **13 index inutilisés** — à surveiller avant de les supprimer
  (peuvent être utiles une fois du trafic réel présent).
- **Bundle frontend > 500 kB** par app (voir §5).

---

## 17. Sécurité — signal seulement (audit dédié pipeline étape 2/3)

Pour éviter la duplication avec les audits sécurité dédiés qui suivent
immédiatement dans le pipeline, cet audit se limite à **signaler** les
points trouvés par les advisors Supabase, sans les traiter :

- 2 fonctions `SECURITY DEFINER` exécutables par `anon` (non
  authentifié) : `get_ride_driver_public_info`,
  `get_ride_passenger_public_info` (**WARN**).
- Protection mots de passe compromis désactivée (**WARN**).
- 3 tables avec RLS activée mais sans policy (`private.app_settings`,
  `public.phone_verifications`, `public.rate_limit_counters`) — **INFO
  seulement** : RLS sans policy = accès refusé par défaut, donc **pas
  une faille en soi**, à confirmer dans l'audit dédié.

→ Traitement complet dans `docs/audits/02-audit-securite-web.md` et
`docs/audits/03-audit-securite-supabase.md`.

---

## 18. Compatibilité / UX

Non traité en détail ici (doublon avec l'audit UX/UI dédié, pipeline
étape 7). Signal réel trouvé : `Alert.alert` (React Native) est un
no-op complet sur `react-native-web` (confirmé en lisant sa source,
TASK-034) — les confirmations d'achat d'abonnement, de paiement cash et
d'annulation de course **n'ont jamais pu être vérifiées visuellement**,
ni en mode web ni sur un vrai appareil.

---

## 19. Tests — écart majeur confirmé

**CONFIRMÉ : 0 fichier de test dans l'intégralité du dépôt**
(`find . -iname "*.test.*" -o -iname "*.spec.*"`, hors
`node_modules`, résultat vide). Aucun framework de test (Vitest, Jest,
Playwright en tant que dépendance déclarée) n'est installé dans aucun
`package.json`.

La vérification qualité de ce projet repose entièrement sur :
1. `tsc --noEmit` (types corrects, ne garantit pas le comportement) ;
2. `oxlint` (style/anti-patterns React) ;
3. des scripts Playwright **écrits dans le scratchpad de session,
   jamais commités**, rejoués manuellement à chaque nouvelle
   fonctionnalité puis supprimés (convention du projet, voir
   `CLAUDE.md`) — donc **aucune protection contre les régressions
   futures** : rien ne rejoue automatiquement ces vérifications au
   prochain changement.

C'est l'écart le plus important trouvé dans cet audit — traité en
détail dans `docs/audits/05-audit-tests-qualite.md` (pipeline étape 5).

---

## 20. Qualité du code

- **0 occurrence de `TODO`/`FIXME`/`HACK`** dans `apps/*/src`,
  `apps/mobile/app`, `supabase/` (grep exhaustif) — soit une discipline
  réelle, soit l'absence de ce type de marqueur dans les habitudes du
  projet (les zones incomplètes sont documentées en prose dans
  `docs/STATUS.md`/`CHANGELOG.md` plutôt qu'en commentaire de code,
  confirmé par lecture).
- Fichiers volumineux : **résolu** (TASK-052, 6 septembre 2026) — plus
  aucun fichier de code ne dépasse 500 lignes.
- Pas de duplication anormale détectée dans les zones lues (web et
  mobile portent des logiques similaires par choix documenté — voir
  `docs/DECISIONS.md`, pas une duplication accidentelle).

---

## 21. Résilience et cas d'erreur — échantillon vérifié

| Scénario | Comportement observé | Preuve |
|---|---|---|
| Session expirée / pas de session | Redirection vers l'écran de connexion (`beforeLoad` du router) | Code + Playwright |
| RPC retourne une erreur (ex. `no_active_subscription`) | Message utilisateur traduit, pas de crash | Code (`DriverHome`/mobile) |
| Édge Function indisponible (réseau) | `invokeError` capturé, message générique affiché | Code (`estimateFare`) |
| Double soumission (achat abonnement) | `busy` désactive le bouton pendant l'appel | Code, non testé en concurrence réelle |
| Retour arrière / refresh pendant une course | **Non vérifié** — dépend entièrement de la re-synchronisation au montage (`loadActiveRide`), jamais testé explicitement | Non vérifiable depuis ce sandbox sans session réelle |

---

## 22. Checklist « site réel »

- [x] Installation propre (`npm install` à la racine, workspaces)
- [x] Build production (3 apps)
- [ ] Variables production confirmées fonctionnelles (Vercel)
- [ ] Domaine
- [ ] HTTPS public confirmé
- [x] Frontend (code)
- [x] Backend (Supabase réel)
- [x] Database (réelle, RLS partout)
- [x] Auth (code email fonctionnel, vérifié)
- [x] Storage (bucket documents chauffeur)
- [ ] Emails transactionnels (le code email d'auth passe par Supabase Auth — non vérifié en conditions réelles depuis ce sandbox)
- [x] Webhooks (Edge Function déployée, jamais appelée par un vrai fournisseur)
- [x] Cron (`pg_cron` actif)
- [ ] Paiement réel (Mobile Money — aucun fournisseur choisi)
- [ ] Monitoring
- [ ] Logs centralisés / alertes
- [ ] Sauvegardes vérifiées (plan Supabase non confirmé)
- [ ] Restauration testée
- [x] Gestion d'erreurs (échantillon vérifié §21)
- [ ] Mobile réel (jamais testé sur émulateur/téléphone)
- [x] Responsive (code, non vérifié visuellement sur vrais appareils)
- [ ] Tests automatisés (**0**, voir §19)
- [ ] Audit sécurité complet (pipeline étape 2/3, à suivre)
- [ ] Performance validée en charge
- [ ] SEO technique (pipeline étape 11, à suivre — site pas encore public)
- [ ] CI/CD avec déploiement automatique (CI vérifie, ne déploie pas)
- [ ] Rollback testé

---

## 23. Matrice de readiness

| Domaine | État | Bloquant ? | Preuve |
|---|:-:|:-:|---|
| Frontend | ✅ | Non | Build + Playwright OK |
| Backend | ✅ | Non | Supabase réel, RLS partout |
| Database | ⚠️ | Non (mais à traiter avant tout nouveau projet Supabase) | §7.1 — migrations désynchronisées |
| Auth | ✅ | Non | Code email vérifié |
| Supabase (sécurité fine) | ⚠️ | À confirmer | Renvoyé aux audits 2/3 |
| Déploiement (Vercel) | 🔴 | **Oui** | TASK-053 non confirmée |
| Domaine | ⚪ | Non (décision produit, pas technique) | Aucun acheté |
| Monitoring | 🔴 | Oui, avant vrais utilisateurs | Rien en place |
| Backup/Restore | ⚠️ | Oui avant données réelles | Jamais testé |
| Tests | 🔴 | Oui pour la fiabilité long terme | 0 test |
| Mobile réel | 🔴 | Oui si le lancement inclut mobile | Jamais testé sur appareil |
| Paiement réel | 🔴 | Oui pour le business, non pour le code | Aucun fournisseur choisi |

## Verdict : 🟠 NOT READY

Le code n'est pas la limite : l'architecture, l'auth, le RLS et les
parcours principaux sont réels et vérifiés. Ce qui bloque une vraie mise
en production aujourd'hui, ce sont des **décisions externes non
techniques** (fournisseur Mobile Money, compte Expo, domaine) et des
**vérifications jamais faites** (déploiement confirmé, mobile réel,
sauvegarde/restauration, tests automatisés).

---

## 24. Liste exacte des bloquants

### BLOQUANTS ABSOLUS (empêchent une mise en ligne réelle)
1. **Déploiement Vercel non confirmé** — `apps/admin` et `apps/web`
   n'ont pas d'URL publique validée. *Correction* : reprendre TASK-053
   (`docs/TASKS.md`). *Vérification* : `curl` sur l'URL finale, charger
   dans un vrai navigateur, se connecter avec un vrai compte.
2. **Aucun fournisseur Mobile Money choisi** — le paiement en ligne
   réel est impossible sans lui (le cash fonctionne déjà). *Correction* :
   décision business (Flooz/TMoney/Semoa), hors périmètre technique.

### À CORRIGER AVANT PRODUCTION (importants, non bloquants pour un lancement en mode cash uniquement)
3. Migrations locales désynchronisées de l'état distant réel (§7.1).
4. Aucune sauvegarde/restauration testée sur le projet Supabase.
5. Mot de passe du compte admin probablement inutilisable
   (`/login` jamais confirmé).
6. `apps/mobile` jamais lancé sur émulateur/téléphone réel — 3
   confirmations `Alert.alert` invérifiables en mode web.

### À CORRIGER APRÈS LE LANCEMENT
7. 0 test automatisé (pipeline étape 5 y consacre un audit complet).
8. 42 clés étrangères sans index (impact seulement à volume réel).
9. Protection mots de passe compromis désactivée (2 minutes, faible
   urgence tant que l'auth reste par code email sans mot de passe pour
   les usagers).

### AMÉLIORATIONS FUTURES
10. Compte Expo/EAS pour activer les notifications push réelles.
11. Domaine personnalisé.
12. Monitoring/alerting.

---

## 25. Roadmap de finalisation

| Étape | Action | Fichiers concernés | Critère de validation |
|---|---|---|---|
| 1 — Fix immédiat | Confirmer le déploiement Vercel (`apps/admin` puis `apps/web`) | `vercel.json`, variables Vercel | Site chargé sans erreur console, connexion réelle réussie |
| 2 — Config production | Réinitialiser le mot de passe admin, tester `/login` | Dashboard Supabase → Auth → Users | Connexion admin réussie avec de vraies données |
| 3 — Base | Réconcilier `supabase/migrations/` avec l'état réel (§7.1) | `supabase/migrations/`, `docs/06-schema-base-donnees.md` | `supabase db push` sur un projet vierge reproduit l'état actuel |
| 4 — Résilience | Vérifier le plan de sauvegarde Supabase actif + tester une restauration | Dashboard Supabase | Restauration réussie sur un projet de test |
| 5 — Tests finaux | Traiter l'audit tests/qualité dédié (pipeline étape 5) | — | Voir cet audit |
| 6 — Go-live (mode cash) | Annoncer le lancement en mode paiement cash uniquement | — | Premiers vrais utilisateurs |
| 7 — Mobile Money | Choisir un fournisseur, brancher `payment-webhook-momo` en réel | Edge Function existante | Premier paiement réel confirmé |

---

## Gaps de cet audit — ce que je n'ai pas pu vérifier

- **Plan Supabase actif et politique de sauvegarde réelle** — nécessite
  le Dashboard (page Billing/Backups), pas accessible via les outils
  MCP utilisés ici.
- **Fonctionnement réel de Google Maps Platform** (clé, quotas,
  facturation) — `maps.googleapis.com` bloqué par la politique réseau
  de ce sandbox.
- **Déploiement Vercel réel** — nécessite soit vos captures d'écran,
  soit un jeton API Vercel pour un accès direct (voir `docs/TASKS.md`
  TASK-053).
- **Comportement sur un vrai téléphone** (Android/iOS) — aucun
  émulateur ni appareil disponible dans ce sandbox.

Pour lever ces incertitudes : confirmer l'URL Vercel une fois en ligne,
donner accès au Dashboard Supabase (Billing) si un audit de sauvegarde
plus poussé est voulu, tester `apps/mobile` sur un vrai téléphone via
Expo Go.
