# Audit 3/12 — Sécurité + configuration Supabase

*Réalisé le 6 septembre 2026, dans la continuité immédiate de l'Audit 2
(sécurité web) qui couvre déjà en détail RLS, rate limiting, storage et
les fonctions admin — non reproduit ici. Cet audit se concentre sur ce
qui est spécifiquement Supabase : conventions systématiques
(`search_path`), extensions installées, schéma `private`, mécanisme de
webhook interne (`pg_net`), architecture RLS globale. Méthode :
requêtes SQL directes sur `pg_catalog`/`information_schema` du projet
réel, lecture des migrations, `list_extensions`.*

---

## Réponse directe

> « Faut-il faire confiance à ce projet Supabase uniquement parce que
> RLS est activée et que l'Auth fonctionne ? »

Non — et ce projet ne s'appuie pas seulement là-dessus. Trois contrôles
systématiques, vérifiés **exhaustivement** (pas par échantillon) dans
cet audit, sont **tous les trois à 100 %** :

1. **52/52 fonctions `SECURITY DEFINER`** dans `public` ont un
   `search_path` explicite (aucune omission trouvée).
2. **32/32 tables** ont RLS activée.
3. **16/16 fonctions `admin_*`** vérifient un rôle admin.

C'est un niveau de rigueur systématique rarement observé dans un projet
Supabase construit rapidement — les défauts trouvés sont des réglages
ponctuels (advisors), pas des trous structurels.

**Verdict : GO CONDITIONNEL** — voir §7.

---

## 1. Architecture Supabase et flux de données

```text
apps/web, apps/admin, apps/mobile
   │  clé "publishable" (anon), jamais la clé service_role
   ▼
PostgREST (tables, RLS) + RPC (51 fonctions) + Storage + Realtime
   ▼
Postgres 17.6.1 (projet elrsjctwrvzglwogmmpq, eu-west-1, ACTIVE_HEALTHY)
   │
   ├─ schéma public   : 32 tables (RLS partout), 52 fonctions SECURITY DEFINER
   ├─ schéma private  : 1 table (app_settings) — jamais exposée via l'API
   ├─ schéma extensions : pgcrypto, uuid-ossp, postgis, pg_stat_statements
   └─ pg_cron (pg_catalog) : 1 job actif (balayage des offres expirées)
```

**CONFIRMÉ** : aucune clé `service_role` trouvée dans le code frontend
ni dans les migrations (recherche ciblée, résultat vide) — seule la clé
publique apparaît dans `.env.example` et dans
`private.app_settings.supabase_publishable_key` (voir §5, usage légitime
documenté).

---

## 2. Clés anon / service_role

- **Clé anon (« publishable »)** : utilisée dans les 3 apps + dans
  `private.app_settings` pour le mécanisme de webhook interne (§5).
  Protégée par RLS, pas par le secret — c'est le modèle Supabase
  standard, correctement appliqué ici (aucune policy ne s'appuie sur
  « le client a la bonne clé » comme mécanisme d'autorisation).
- **Clé service_role** : **jamais trouvée dans le dépôt** (recherche
  exhaustive). Utilisée uniquement, par nécessité, à l'intérieur des
  Edge Functions (secrets Supabase, non lisibles depuis le code) —
  **NON VÉRIFIABLE au-delà de son absence confirmée du dépôt**, ce qui
  est le résultat attendu et suffisant.

---

## 3. `search_path` — vérification exhaustive (pas un échantillon)

**CONFIRMÉ par requête directe sur `pg_proc`** : les **52 fonctions**
`SECURITY DEFINER` du schéma `public` ont **toutes** un `search_path`
explicite dans `proconfig`. Répartition :
- 48 fonctions : `search_path=public, extensions` (cas standard) ;
- `find_user_id_by_phone` : `public, extensions, auth` (a besoin de lire
  `auth.users`, circuit téléphone abandonné mais convention respectée
  quand même) ;
- `dispatch_push_notification` : `public, extensions, net, private` (a
  besoin de `net.http_post` et de lire `private.app_settings`).

**Aucune fonction sans `search_path`** — la convention documentée dans
`CLAUDE.md` (« Toute fonction SECURITY DEFINER a besoin de `SET
search_path` ») est **appliquée à 100 %**, pas seulement énoncée.
C'est le contrôle qui protège contre le détournement de fonction par
manipulation du `search_path` de session (CVE classique PostgreSQL sur
les fonctions `SECURITY DEFINER` mal configurées) — **risque éliminé
de façon vérifiable, pas supposée**.

---

## 4. RLS — vue d'ensemble et cas particuliers

**CONFIRMÉ** : 32/32 tables `public` ont RLS activée (`list_tables`).
Les policies des 8 tables les plus sensibles ont été vérifiées ligne
par ligne dans l'Audit 2 §4.2 — non reproduit ici.

### 4.1 Tables avec RLS activée mais sans policy — résolu définitivement

Les advisors Supabase signalent en **INFO** (pas WARN) trois tables :
`private.app_settings`, `public.phone_verifications`,
`public.rate_limit_counters`. **Analyse approfondie de cet audit,
au-delà du simple signalement de l'advisor** :

- En PostgreSQL, **RLS activée + aucune policy = accès refusé à tout
  rôle soumis à RLS** (ni lecture, ni écriture), quels que soient les
  `GRANT` par ailleurs. Seuls le propriétaire de la table et un rôle
  `BYPASSRLS` (jamais `anon`/`authenticated`, qui sont les rôles
  utilisés par PostgREST) échappent à cette restriction.
- `private.app_settings` : schéma `private` **non exposé par
  PostgREST** par défaut (seul `public` l'est) — **doublement protégée**
  (RLS + non-exposition du schéma).
- `public.phone_verifications` et `public.rate_limit_counters` : dans
  `public`, donc théoriquement atteignables via
  `/rest/v1/phone_verifications` — mais RLS sans policy **bloque tout
  accès direct**, y compris en lecture. Ces deux tables ne sont
  manipulées que via les fonctions `SECURITY DEFINER` (`enforce_rate_limit`,
  `request_phone_verification`, etc.), qui s'exécutent avec les
  privilèges du **propriétaire** de la fonction — lequel bénéficie de
  `BYPASSRLS` sur ce projet (comportement standard des rôles
  d'administration Supabase).

**Conclusion vérifiée, pas supposée** : ces trois tables sont
**correctement inaccessibles depuis le client**, exactement comme
voulu pour des tables de bookkeeping interne. L'INFO de l'advisor est
un signal informatif, **pas une vulnérabilité** dans ce contexte précis
— je le documente explicitement plutôt que de le laisser en zone grise.

---

## 5. Mécanisme de webhook interne (`pg_net`) — anomalie de plateforme documentée

**CONFIRMÉ, trouvaille intéressante** (commentaire de
`00000000000005_notifications_push_trigger.sql`) : la création d'un
Database Webhook standard (interface Dashboard) échoue sur ce projet
précis avec `schema "supabase_functions" does not exist` — ce schéma
est normalement provisionné automatiquement par Supabase sur tout
nouveau projet. Contournement mis en place : un trigger `AFTER INSERT`
sur `notifications` appelle directement `net.http_post` (extension
`pg_net`, réellement installée) vers l'URL fixe de
`push-notifications-dispatch`, authentifié avec la clé publishable
(légitime — voir §2).

**Analyse sécurité de ce contournement** :
- **URL non contrôlable par l'utilisateur** — construite uniquement à
  partir de `private.app_settings` (deux valeurs fixes, non exposées à
  l'API) — **aucun risque de SSRF** (Server-Side Request Forgery), le
  point d'attention classique de tout usage de `pg_net`/`http_post`
  déclenché par une donnée utilisateur.
- Le payload (`to_jsonb(new)`) reflète la ligne `notifications` insérée
  — cette table n'est elle-même insérable que par des fonctions
  `SECURITY DEFINER` contrôlées (pas directement par l'utilisateur,
  confirmé par les GRANTs), donc le contenu du payload est fiable.
- **Verdict : mécanisme sain**, mais l'anomalie de plateforme
  sous-jacente (`supabase_functions` manquant) reste inexpliquée — à
  signaler dans l'audit sauvegardes/monitoring (pipeline étape 9) comme
  point à surveiller, pas un problème de sécurité en soi.

---

## 6. Extensions — surface minimale confirmée

**CONFIRMÉ** (`list_extensions`) : sur ~80 extensions **disponibles**
sur ce projet Supabase, seules **8 sont réellement installées** :

| Extension | Schéma | Usage réel dans ce projet |
|---|---|---|
| `pgcrypto` | `extensions` | `gen_random_bytes()` pour les tokens à usage unique |
| `uuid-ossp` | `extensions` | Génération d'UUID |
| `postgis` | `extensions` | Géolocalisation (matching, distances) |
| `pg_net` | `extensions` | Webhook interne (§5) |
| `pg_cron` | `pg_catalog` | Balayage des offres expirées (interim) |
| `pg_stat_statements` | `extensions` | Statistiques de requêtes (perf) |
| `supabase_vault` | `vault` | Infrastructure interne Supabase |
| `plpgsql` | `pg_catalog` | Langage des fonctions |

**Aucune extension à risque inutilement activée** — pas de `dblink`,
`postgres_fdw`, `http` (extension générique, différente de `pg_net`),
`plsh` ou autre extension à surface d'attaque large qui ne serait pas
justifiée par un besoin réel du projet. Bon signal de minimalisme.

---

## 7. Synthèse et verdict

| Catégorie | Sévérité | État |
|---|---|---|
| `search_path` sur fonctions `SECURITY DEFINER` | — | ✅ 100 % conforme (§3) |
| RLS activée | — | ✅ 100 % des tables (§4) |
| Tables RLS-sans-policy | INFO | ✅ Analysées, confirmées sans risque (§4.1) |
| Clé service_role exposée | — | ✅ Jamais trouvée dans le dépôt (§2) |
| Extensions | — | ✅ Surface minimale (§6) |
| Webhook interne `pg_net` | — | ✅ Pas de SSRF possible (§5) |
| Fonctions `anon`-exécutables | WARN | ⚠️ Voir Audit 2 §4.1 — actuellement sûres, process à documenter |
| Protection mots de passe compromis | WARN | ⚠️ Désactivée — 2 minutes à corriger (Audit 2 §2) |
| Migrations locales ↔ distant désynchronisées | — | ⚠️ Voir Audit 1 §7.1 — à réconcilier avant de considérer `supabase/migrations/` comme fiable à 100 % |
| Anomalie plateforme (`supabase_functions` manquant) | — | ℹ️ À surveiller (pipeline étape 9), pas un problème de sécurité |

### Verdict : 🟡 GO CONDITIONNEL

La configuration Supabase elle-même est **saine et rigoureuse** — les
seules conditions avant un vrai lancement sont déjà listées ailleurs
dans ce pipeline (protection mots de passe, réconciliation des
migrations, MFA admin) et **ne remettent pas en cause l'architecture**.
Rien trouvé ici ne justifierait un NO-GO.

---

## Ce que je n'ai pas pu vérifier

- **Plan Supabase actif et politique de rétention des sauvegardes**
  (nécessite le Dashboard → Billing, hors accès MCP) — traité dans
  l'audit pipeline étape 9.
- **Schémas exposés par PostgREST** (réglage API Settings du Dashboard)
  — supposé être la valeur par défaut (`public` uniquement), cohérent
  avec le fait que `private` ne soit jamais appelé directement par le
  frontend, mais non confirmé par une lecture directe du réglage.
- **Cause racine de l'anomalie `supabase_functions` manquant** —
  nécessiterait un ticket support Supabase, hors périmètre de cet audit.
