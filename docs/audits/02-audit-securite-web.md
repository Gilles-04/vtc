# Audit 2/12 — Sécurité complète d'un site web en développement

*Réalisé le 6 septembre 2026. Méthode : lecture directe des migrations
SQL (logique d'autorisation réelle), interrogation du projet Supabase
distant (policies RLS réelles via `pg_policies`, advisors sécurité),
lecture du code frontend (recherche de vecteurs XSS/redirection),
`npm audit`. Aucun test d'intrusion réseau réel effectué (pas d'URL
publique confirmée à ce jour — voir Audit 1 §13). Classification :
**Vulnérabilité confirmée** / **Risque suspecté** / **Bonne pratique
manquante** / **NON VÉRIFIABLE AVEC LES ÉLÉMENTS FOURNIS**.*

---

## Réponse directe

> « Cette application peut-elle raisonnablement être mise en
> production, et que faut-il corriger avant ? »

Le contrôle d'accès **côté base de données est le point fort réel de ce
projet** — chaque policy RLS vérifiée s'appuie sur `auth.uid()` ou un
rôle admin explicite, aucune n'a été trouvée trop permissive parmi les
tables sensibles auditées (paiements, courses, documents chauffeur,
tickets support, SOS, stockage). Un vrai bug d'autorisation a existé
puis **a été trouvé et corrigé par le projet lui-même** (voir §4.1) —
signe d'un processus de revue qui fonctionne. Les points faibles réels
sont ailleurs : **protection mots de passe compromis désactivée**,
**absence de scan de sécurité automatisé en CI**, et surtout
**l'absence de toute vérification en conditions réseau réelles**
puisqu'aucune URL publique n'existe encore.

**Verdict : 🟡 SEO... non — 🟡 ACCEPTABLE AVEC CORRECTIONS MINEURES**
pour la partie auditable ici ; **NON VÉRIFIABLE** pour tout ce qui
dépend d'un déploiement public (voir §11).

---

## 1. Reconstruction du système et surfaces d'attaque

```text
Utilisateur (navigateur / app Expo)
   ↓ HTTPS direct (pas de proxy applicatif custom)
Supabase Cloud (PostgREST + RPC + Auth + Storage + Edge Functions)
   ↓
Postgres 17 (RLS sur 32/32 tables)
```

Surfaces d'attaque réelles identifiées :
- **Frontend** : 3 apps client-side, aucune logique de sécurité
  n'y est déléguée (confirmé — voir §3).
- **API** : PostgREST auto-généré (tables) + 51 RPC + 5 Edge Functions.
  Pas d'API custom Node/Express à auditer séparément.
- **Base de données** : Postgres géré par Supabase, RLS comme unique
  ligne de défense d'accès aux données (pas de couche applicative
  intermédiaire).
- **Stockage** : 1 bucket (`driver-documents`), policies RLS dédiées.
- **CI/CD** : GitHub Actions, aucun secret configuré (vérifié, voir
  Audit 1 §13) — surface d'attaque CI minimale de fait.

---

## 2. Authentification

**CONFIRMÉ** : authentification par **code à usage unique envoyé par
email** (Supabase Auth OTP), **aucun mot de passe** pour les usagers
(passager/chauffeur). L'implémentation du flux OTP (génération,
expiration, limitation de tentatives, stockage des codes) est **interne
à Supabase Auth — NON VÉRIFIABLE AVEC LES ÉLÉMENTS FOURNIS** (pas
d'accès aux logs internes du service Auth).

- **Bonne pratique manquante (WARN confirmé par les advisors
  Supabase)** : la protection contre les mots de passe compromis
  (vérification HaveIBeenPwned) est **désactivée**. Impact réel limité
  ici car les usagers n'ont pas de mot de passe — pertinent uniquement
  pour le **compte admin** (`apps/admin`, connexion classique
  email/mot de passe via Supabase Auth). *Correction* : interrupteur
  dans Dashboard Supabase → Auth → Policies, 2 minutes, aucun risque de
  régression.
- Le compte admin actuel (`abotchigilles@yahoo.fr`) a été créé comme
  passager (code email) puis promu `super_admin` en base — **il n'a
  jamais eu de mot de passe défini via un vrai formulaire**. `/login`
  échouera tant qu'un mot de passe n'aura pas été fixé depuis le
  Dashboard (Authentication → Users → Reset password). *Ce n'est pas
  une vulnérabilité, mais un blocage opérationnel identique à l'Audit 1
  §24.*
- **Pas de MFA** sur le compte admin. Risque réel : un `super_admin`
  compromis a accès à `admin_stats_overview`, aux remboursements, à la
  levée de suspension de compte. *Recommandation P1* : activer le MFA
  Supabase Auth pour tout compte admin, une fois le mot de passe fixé.

---

## 3. Frontend

**CONFIRMÉ** (grep exhaustif sur les 3 apps) :
- **Aucun `dangerouslySetInnerHTML`, `innerHTML`, `eval()` ou
  `new Function()`** dans `apps/web`, `apps/admin`, `apps/mobile` — pas
  de vecteur XSS DOM trouvé.
- **Aucune assignation directe à `window.location`** ni `window.open`
  non contrôlé — pas d'open redirect trouvé côté client.
- Les clés publiques (`VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_GOOGLE_MAPS_API_KEY`) sont **conçues pour être publiques** —
  leur présence dans le bundle JS n'est pas un défaut (la clé anon
  Supabase est protégée par RLS, pas par le secret ; la clé Google Maps
  doit être restreinte par referrer HTTP côté console Google — **NON
  VÉRIFIABLE** depuis ce sandbox si la restriction est bien active).
- **Contrôle d'accès côté client uniquement décoratif, jamais la seule
  barrière** : chaque garde de route (`beforeLoad`) ne fait que
  rediriger visuellement — la vraie protection est RLS côté base,
  vérifié §5. C'est la bonne architecture (« si un attaquant ignore le
  frontend et appelle l'API directement, que peut-il faire ? » — réponse
  vérifiée table par table en §5, pas supposée).

---

## 4. Logique métier et autorisation — le cœur de cet audit

### 4.1 Vulnérabilité confirmée puis corrigée par le projet lui-même

**CONFIRMÉ, historique réel** (`supabase/migrations/00000000000014_fix_ride_public_info_null_safety.sql`) :
les fonctions `get_ride_driver_public_info` et
`get_ride_passenger_public_info` (migration 13) comparaient
`_ride.passenger_id <> auth.uid()` pour bloquer les appels non
autorisés. En SQL, `NULL <> valeur` renvoie `NULL`, traité comme `FALSE`
par PL/pgSQL dans un `if` — donc **un appel anonyme (`auth.uid()` NULL)
portant un `_ride_id` valide passait le contrôle sans lever
`not_authorized`**. Root cause : ces fonctions sont `SECURITY DEFINER`
et **`anon` conserve `EXECUTE` par défaut** sur toute fonction créée
dans `public` (convention assumée du projet : la sécurité vient du
contenu de la fonction, pas d'un `REVOKE` sur `anon` — documenté
explicitement dans le commentaire de la migration 8).

**Corrigé en migration 14** : remplacement par `IS DISTINCT FROM`,
NULL-safe par construction. **Vérifié dans cet audit** : la condition
`_ride.passenger_id IS DISTINCT FROM auth.uid()` avec `auth.uid()`
NULL et `passenger_id` non NULL renvoie `TRUE` → lève bien
`not_authorized`. **État actuel : CORRIGÉ ET CONFIRMÉ SAIN.**

**Pourquoi je le documente comme un point positif malgré tout** : la
convention « sécurité dans le corps de la fonction, `anon` garde
EXECUTE » est un choix de conception qui **fonctionne seulement si
chaque nouvelle fonction respecte strictement le même pattern**. C'est
un risque de **process**, pas un bug actuel — toute future fonction
`SECURITY DEFINER` ajoutée sans ce réflexe NULL-safe réintroduirait la
même classe de bug. *Recommandation P2* : ajouter une note dans
`CLAUDE.md` (déjà fait implicitement par cet audit — à formaliser).

### 4.2 RLS vérifiée sur les tables sensibles — aucune faille trouvée

**CONFIRMÉ** (requête directe `pg_policies` sur le projet réel) :

| Table | Policy SELECT | Portée réelle |
|---|---|---|
| `payments` | `user_id = auth.uid() OR (ride_id existe ET je suis le chauffeur de cette course) OR admin/finance` | ✅ Un passager ne voit que ses paiements, un chauffeur voit ceux liés à ses courses |
| `drivers` | `auth.uid() = id OR admin/support` | ✅ |
| `rides` | `passenger_id = auth.uid() OR driver_id = auth.uid() OR admin/support` | ✅ |
| `driver_documents` | `driver_id = auth.uid() OR super_admin/admin` | ✅ Un chauffeur ne voit pas les documents des autres |
| `invoices` | `passenger_id = auth.uid() OR driver_id = auth.uid() OR admin/finance` | ✅ |
| `profiles` | `auth.uid() = id OR admin/support/finance` | ✅ |
| `sos_alerts` | `triggered_by = auth.uid() OR admin/support` | ✅ |
| `support_tickets` | `user_id = auth.uid() OR admin/support` | ✅ |

**Aucune de ces policies n'autorise `anon`** (toutes portent
`roles: {public}` mais la condition exige `auth.uid()` non NULL ou un
rôle admin, ce qui exclut de fait un appel non authentifié — le rôle
Postgres `public` inclut `anon` et `authenticated`, mais la clause
`qual` filtre correctement).

### 4.3 Protection contre le mass assignment sur `drivers` — bon réflexe confirmé

**CONFIRMÉ, point fort à souligner explicitement** : la policy RLS
`drivers_update_own` autorise un chauffeur à modifier sa propre ligne
(`auth.uid() = id`), ce qui, **avec RLS seul**, lui permettrait en
théorie de modifier n'importe quelle colonne — y compris `status`
(passer lui-même son dossier en `approved`) ou `rating_avg`. **Ce
risque est neutralisé par un GRANT au niveau colonne** :

```sql
grant update (is_available, current_location, last_location_at) on public.drivers to authenticated;
```

PostgreSQL applique les deux contrôles en cumulé (GRANT colonne **et**
RLS ligne) — un chauffeur ne peut donc physiquement pas modifier
`status`, `acceptance_rate`, `rating_avg`, etc. via PostgREST, même en
forgeant une requête PATCH directe. **C'est exactement le contrôle qui
manque le plus souvent dans les projets Supabase construits vite** —
confirmé présent ici. Bon niveau de rigueur.

### 4.4 Fonctions admin — 100 % vérifiées, aucun oubli

**CONFIRMÉ** : les 16 fonctions `public.admin_*` ont chacune
exactement un appel à `private.has_admin_role(...)` dans leur corps
(vérifié une par une par script). **Aucune fonction admin trouvée sans
contrôle de rôle.**

### 4.5 `admin_roles` — pas d'auto-promotion possible

**CONFIRMÉ** : la table `admin_roles` a un GRANT large
(`select, insert, update, delete` à `authenticated`) mais une **seule
policy `ALL` exigeant `super_admin`** pour toute opération, y compris
`INSERT` (`with_check` identique). Un utilisateur authentifié normal ne
peut donc **pas s'auto-promouvoir admin** malgré le GRANT permissif au
niveau table — c'est la policy RLS qui referme la porte. Confirmé sain.

### 4.6 Limitation de débit — réelle mais partielle

**CONFIRMÉ** : `private.enforce_rate_limit()` est une fonction réelle
(pas un stub), **appelée effectivement** dans :
- `create_ride_request` (5 par 5 minutes par utilisateur) ;
- `purchase_subscription` (10 par heure) ;
- `create_support_ticket` (10 par heure) ;
- `phone_verify` (circuit abandonné, code mort de fait).

**Non protégés par cette fonction** (vérifié par grep, absence
confirmée) : `trigger_sos`, `respond_to_ride_offer`, `cancel_ride`,
`update_driver_location`. Impact réel :
- `trigger_sos` sans limite : un compte compromis pourrait spammer de
  fausses alertes SOS — **risque suspecté, sévérité faible à modérée**
  (nécessite déjà un compte authentifié compromis, et chaque alerte
  reste tracée par `triggered_by`, donc attribuable).
- `update_driver_location` : appelée par le client toutes les ~15-20 s
  (throttlé côté client, pas serveur) — un client modifié pourrait
  spammer des mises à jour de position. Impact : dégradation de
  performance, pas de fuite de données.
- `respond_to_ride_offer`/`cancel_ride` : usage naturellement limité
  par le nombre de courses/offres réelles disponibles à un utilisateur
  — risque faible.

*Recommandation P2* : étendre `enforce_rate_limit` à `trigger_sos`
(ex. 3 par 10 minutes) pour couvrir le seul scénario avec un impact
opérationnel réel (mobiliser une fausse intervention).

---

## 5. Stockage (bucket `driver-documents`)

**CONFIRMÉ** (policies réelles interrogées) : SELECT/INSERT/UPDATE/DELETE
tous scopés sur `storage.foldername(name)[1] = auth.uid()::text` (le
premier segment du chemin doit être l'UUID de l'utilisateur), plus accès
admin explicite en lecture. **Isolation correcte confirmée** — un
chauffeur ne peut pas lire, écraser ni supprimer les documents d'un
autre chauffeur.

---

## 6. Edge Functions

| Fonction | `verify_jwt` | CORS | Observation |
|---|:-:|---|---|
| `pricing-directions` | ✅ | `Access-Control-Allow-Origin: *` | Appelle Google Directions API côté serveur avec la clé secrète — clé jamais exposée au client (confirmé, séparée de `VITE_GOOGLE_MAPS_API_KEY`) |
| `payment-webhook-momo` | ✅ | `*` | **Point à vérifier avant tout fournisseur réel** : un webhook de paiement doit généralement être authentifié par signature du fournisseur, pas seulement par JWT Supabase (un JWT utilisateur n'a pas de sens pour un webhook serveur-à-serveur) — **à revoir précisément une fois un fournisseur Mobile Money choisi**, car le mécanisme de vérification dépendra de ce que ce fournisseur propose (signature HMAC, IP allowlist, etc.). Non traitable génériquement aujourd'hui. |
| `phone-verification-*` | ✅ | `*` | Code mort fonctionnellement (circuit abandonné) mais toujours déployé et exposé |
| `push-notifications-dispatch` | ✅ | — | Vérifiée bout en bout (TASK-089) |

`Access-Control-Allow-Origin: *` sur toutes les fonctions : **acceptable
ici** car l'architecture n'utilise pas de cookies de session (auth par
Bearer token dans l'en-tête `Authorization`, jamais lu automatiquement
cross-origin par un navigateur tiers) — un CORS large n'ouvre donc pas
de CSRF classique. Reste une **bonne pratique manquante** : restreindre
à `https://<domaine-final>` une fois le domaine de production connu,
par défense en profondeur plutôt que par nécessité stricte.

---

## 7. Dépendances / supply chain

**CONFIRMÉ** (`npm audit --omit=dev`) : **13 vulnérabilités, sévérité
modérée uniquement**, toutes concentrées dans `@expo/cli` et ses
dépendances de configuration (`xcode`, `@expo/config-plugins`) —
**outillage de build/développement, jamais exécuté dans le bundle
livré à un utilisateur final**. Aucune vulnérabilité haute ou critique.
Correctif disponible (`expo@46.0.21`) mais impliquerait une régression
de version majeure (Expo SDK 57 actuellement utilisé) — **non
recommandé de downgrader** pour corriger une vulnérabilité de
tooling sans exposition réelle ; à réévaluer à la prochaine mise à
jour planifiée d'Expo.

---

## 8. Secrets

**CONFIRMÉ** : aucun secret trouvé en clair dans le code (`grep` ciblé
sur les motifs `service_role`, `sk_live_`, `AIzaSy`, etc. — vide).
`.env` correctement ignoré par git dans les 3 apps. Aucun `.env` n'a
jamais été commité (historique git vérifié). `GOOGLE_MAPS_API_KEY`
(serveur) et `ESMS_AFRICA_API_KEY` vivent uniquement dans les secrets
Edge Functions Supabase (non lisibles depuis le code, **NON
VÉRIFIABLE** au-delà de leur absence du dépôt — leur valeur réelle
n'est pas accessible depuis cet audit, ce qui est le comportement
attendu).

---

## 9. CI/CD

**CONFIRMÉ** : `.github/workflows/ci.yml` exécute `tsc --noEmit`,
`vite build`, `oxlint` — **aucune étape `npm audit`, aucun scan SAST,
aucun secret scanning automatisé**. Aucun secret n'est configuré dans
le repository GitHub à ce jour (confirmé nécessaire nulle part dans le
workflow). *Recommandation P2* : ajouter `npm audit --omit=dev
--audit-level=high` comme étape non bloquante (`continue-on-error`) pour
avoir un signal visible sans casser le pipeline sur les vulnérabilités
modérées déjà connues et non exploitables (§7).

---

## 10. Chaînes d'attaque envisagées

- **RLS insuffisante + API exposée** : écarté — RLS vérifiée correcte
  sur les 8 tables les plus sensibles, GRANT colonne en renfort sur
  `drivers`.
- **Compte admin compromis** : impact réel élevé (accès
  `admin_stats_overview`, remboursements, suspension de comptes) —
  **atténuant** : pas de mot de passe actif actuellement (bloqué), pas
  de MFA une fois activé. *P1 avant tout vrai lancement.*
- **Webhook de paiement falsifié** : dépend entièrement du mécanisme
  d'authentification du futur fournisseur Mobile Money — à traiter au
  moment du choix, pas avant (voir §6).

---

## 11. Ce que je n'ai pas pu vérifier

- **Aucun test réseau réel** (headers HTTP, TLS, CSP, HSTS) — aucune
  URL publique confirmée à ce jour (Audit 1, TASK-053 ouverte). À
  refaire dès que `apps/web`/`apps/admin` sont en ligne.
- **Comportement réel de l'OTP Supabase Auth** (délai d'expiration,
  nombre de tentatives, limitation par IP) — interne au service géré,
  aucun accès aux logs internes depuis cet environnement.
- **Restriction referrer HTTP réelle de la clé Google Maps** — nécessite
  la console Google Cloud, non accessible ici.
- **Comportement du futur webhook Mobile Money** — dépend d'un
  fournisseur non encore choisi.

---

## 12. Plan de remédiation

### P0 — Avant toute mise en production
*Aucun trouvé dans le périmètre auditable ici* — les deux bloquants
réels du projet (déploiement, Mobile Money) sont déjà trackés côté
Audit 1, pas des failles de sécurité en soi.

### P1 — Avant production si possible
1. Activer la protection mots de passe compromis (Dashboard Supabase →
   Auth) — 2 minutes.
2. Fixer un mot de passe réel + activer le MFA sur le compte
   `super_admin` avant toute connexion admin en production.

### P2 — À corriger rapidement
3. Étendre `enforce_rate_limit` à `trigger_sos`.
4. Ajouter `npm audit` en CI (non bloquant).
5. Restreindre `Access-Control-Allow-Origin` des Edge Functions au(x)
   domaine(s) final(aux) une fois connus.
6. Documenter formellement dans `CLAUDE.md` la convention « toute
   nouvelle fonction `SECURITY DEFINER` accessible à `anon` doit
   utiliser `IS DISTINCT FROM`, jamais `<>`/`!=`, pour comparer
   `auth.uid()` » (leçon de §4.1).

### P3 — Amélioration
7. Revue du mécanisme d'authentification du webhook Mobile Money au
   moment du choix du fournisseur.
8. Supprimer ou désactiver `phone-verification-start`/`-check` si le
   circuit SMS reste définitivement abandonné (actuellement inoffensif
   mais surface d'attaque inutile).

---

## Checklist de production (sécurité)

- [x] RLS activée sur toutes les tables
- [x] Policies vérifiées sans faille sur les tables sensibles
- [x] Pas de secret commité
- [x] Pas de vecteur XSS trouvé côté frontend
- [x] Rate limiting réel sur les actions les plus sensibles
- [ ] Protection mots de passe compromis activée
- [ ] MFA sur les comptes admin
- [ ] `npm audit` en CI
- [ ] Vérification réseau réelle (headers, TLS) — après déploiement
- [ ] Mécanisme d'auth du webhook Mobile Money — après choix fournisseur

---

**Verdict final : 🟡 ACCEPTABLE AVEC CORRECTIONS MINEURES** pour la
partie du système auditable aujourd'hui (base de données, logique
métier, frontend, secrets). Le dossier sécurité le plus approfondi côté
Supabase (grants détaillés, `search_path`, extensions) est traité dans
`docs/audits/03-audit-securite-supabase.md` (étape suivante du
pipeline).
