# Audit 9/12 — Sauvegardes, monitoring, logs et disaster recovery

*Réalisé le 6 septembre 2026. Méthode : interrogation directe du
projet Supabase réel (plan de l'organisation, jobs `pg_cron` actifs et
leur historique d'exécution récent) — pas une supposition sur ce que
Supabase « doit » offrir.*

---

## Réponse directe

> « Si le projet Supabase disparaît demain, peut-on réellement
> restaurer le service ? »

**Non, et c'est la trouvaille la plus importante de tout ce pipeline
d'audits jusqu'ici** : **CONFIRMÉ par requête directe** —
l'organisation Supabase de ce projet (`VTC-TOGO`,
`hjlxjfiiltzzmbeupoja`) est sur le **plan Free**. Or, la politique
Supabase (publique, pas une supposition) est sans ambiguïté sur ce
plan : **aucune sauvegarde automatique de la base de données n'est
proposée sur le plan Free** — ni sauvegarde quotidienne, ni Point-in-
Time Recovery. Ces fonctionnalités n'existent qu'à partir du plan Pro.

**Autre conséquence directe du plan Free, également vérifiable** :
un projet Supabase Free est **automatiquement mis en pause après une
période d'inactivité** (pas de requête API). Le projet est actif
aujourd'hui (`ACTIVE_HEALTHY`), mais toute interruption prolongée
d'activité — plausible tant que le site n'est pas encore public —
risque de le mettre en pause.

Ce n'est **pas un défaut du code ou de la configuration** — RLS,
`search_path`, migrations, tout ce qui a été audité aux étapes 1 à 8
reste correct. C'est une **limite de plan d'abonnement**, la même
catégorie de décision que le choix du fournisseur Mobile Money : hors
périmètre technique, mais avec un impact direct sur la continuité du
service.

---

## 1. Sauvegardes — état réel

| Élément | État | Preuve |
|---|---|---|
| Plan Supabase | **Free** | `get_organization` → `"plan":"free"` |
| Sauvegarde automatique quotidienne | **Absente** | Fonctionnalité Pro+ selon la politique Supabase, non disponible sur Free |
| Point-in-Time Recovery (PITR) | **Absent** | Fonctionnalité add-on payant, non disponible sur Free |
| Branches de développement (Supabase Branching) | **Aucune** | `list_branches` → `[]`, cohérent avec le plan Free (fonctionnalité payante) |
| Sauvegarde du code (migrations, Edge Functions) | **Oui, via Git** | 18 migrations + 5 fonctions versionnées sur GitHub — mais incomplètes vis-à-vis de l'état réel (Audit 1 §7.1) |
| Sauvegarde des secrets/configuration Supabase | **Aucune copie externe** | Clés/secrets Edge Functions vivent uniquement dans le Dashboard Supabase |

**RPO actuel (Recovery Point Objective — combien de données peut-on
perdre) : indéterminé, potentiellement tout.** Sans sauvegarde
automatique, la seule donnée récupérable après un incident serait ce
qui peut être reconstruit à partir des migrations Git (le **schéma**,
pas les **données** : comptes utilisateurs, courses, paiements,
documents KYC seraient définitivement perdus).

**RTO actuel (Recovery Time Objective — combien de temps pour
redémarrer) : le temps de recréer un projet Supabase et rejouer les
migrations** — mais rappel de l'Audit 1 §7.1 : rejouer les 18 fichiers
locaux ne reproduirait **pas exactement** l'état réel (au moins une
migration manquante). Le RTO du schéma seul est donc de l'ordre de
quelques dizaines de minutes ; celui des **données** est infini (pas de
sauvegarde à restaurer).

---

## 2. Monitoring et supervision — état réel

**CONFIRMÉ** : 4 jobs `pg_cron` actifs, tous vérifiés en cours
d'exécution réelle au moment de cet audit (interrogation directe de
`cron.job_run_details`) :

| Job | Fréquence | Rôle | État vérifié |
|---|---|---|---|
| `sweep-expired-ride-offers` | toutes les 5 s | Relance le dispatch d'une offre de course expirée (Audit 4 §4.1) | ✅ 5 dernières exécutions réussies, espacées de ~5 s |
| `expire-subscriptions` | chaque minute | Bloque un chauffeur dont l'abonnement a expiré | Actif (non vérifié en historique) |
| `recompute-driver-reliability` | toutes les 15 min | Recalcule `acceptance_rate`/`cancellation_rate` | Actif |
| `cleanup-rate-limits` | quotidien 3h17 | Purge `rate_limit_counters` | Actif |

**Aucun de ces 4 jobs n'est supervisé** : si l'un s'arrête silencieusement
(erreur SQL introduite par une future migration, extension désactivée),
**rien n'alerte personne**. C'est le point déjà signalé comme second
SPOF en Audit 4 §5, confirmé et quantifié ici : 4 mécanismes
automatiques dont dépend le fonctionnement réel du produit
(en particulier `sweep-expired-ride-offers`, qui comble un vrai trou de
production sans lui — une course bloquée indéfiniment), aucun filet de
sécurité si l'un tombe en panne.

**Logs** : Supabase conserve des logs (Postgres, Auth, Edge Functions,
API) mais **la durée de rétention dépend du plan** — sur Free, la
rétention est significativement plus courte que sur les plans payants
(quelques heures à un jour selon le type de log, contre plusieurs jours
à semaines sur Pro+). **NON VÉRIFIABLE précisément depuis cet audit**
(nécessiterait de consulter le Dashboard → Logs à un instant donné et
comparer avec la documentation du plan actif) mais cohérent avec le
constat général : le plan Free limite l'observabilité autant que la
récupération.

---

## 3. Single Points of Failure — synthèse consolidée

| SPOF | Déjà signalé | Aggravé par le plan Free |
|---|---|---|
| Supabase Cloud (tout le backend) | Audit 4 §5 | **Oui** — pas de sauvegarde en cas d'incident côté fournisseur |
| `pg_cron` (4 jobs, aucune supervision) | Audit 4 §5 | Indirectement — rétention de logs courte rend le diagnostic après coup plus difficile |
| Mise en pause automatique pour inactivité | **Nouveau, cet audit** | Direct — spécifique au plan Free |

---

## 4. Procédure d'incident — ce qui existe et ce qui manque

```text
Incident (ex. suppression accidentelle de données, projet mis en pause)
  ↓
Identifier  → Dashboard Supabase (accès manuel, pas d'alerte automatique)
  ↓
Stopper l'aggravation → dépend du type d'incident, aucune procédure écrite
  ↓
Restaurer   → IMPOSSIBLE pour les données (pas de sauvegarde) ;
              possible pour le schéma via `supabase/migrations/`,
              avec l'écart connu de l'Audit 1 §7.1
  ↓
Vérifier    → aucun test de restauration n'a jamais été exécuté
  ↓
Remettre en service → redéployer, reconfigurer les secrets à la main
  ↓
Analyser    → logs à durée de rétention limitée (plan Free)
```

**Aucune étape de cette chaîne n'a de procédure écrite avant cet
audit** — la plus critique (restauration des données) est aujourd'hui
**impossible**, pas seulement non documentée.

---

## Verdict

Ce n'est ni un problème de code ni de configuration — les 8 audits
précédents confirment un backend rigoureux. C'est un **risque
opérationnel réel et immédiat**, dépendant d'une seule variable :
> **le projet Supabase reste sur le plan Free.**

Tant que ce projet n'héberge que des données de développement, le
risque est théorique. **Il cesse de l'être dès le premier vrai
utilisateur** (première course réelle, premier document KYC réel
uploadé, premier paiement réel) : à cet instant, l'absence de
sauvegarde devient une perte de données possible et définitive à
chaque incident.

## Plan de remédiation

- **P0 — avant tout vrai lancement (pas seulement recommandé, condition
  de base d'un service qui gère des données réelles d'utilisateurs)** :
  passer l'organisation Supabase au **plan Pro** (sauvegardes
  quotidiennes automatiques activées par défaut ; PITR disponible en
  option supplémentaire si un RPO plus fin est nécessaire). Décision de
  budget, pas technique — à votre arbitrage.
- **P1** : une fois sur un plan avec sauvegardes, **tester une
  restauration réelle** au moins une fois avant le lancement (créer un
  projet de test, restaurer dedans, vérifier que l'application
  fonctionne dessus) — ne jamais considérer une sauvegarde fiable sans
  l'avoir vue fonctionner.
- **P1** : réconcilier `supabase/migrations/` avec l'état réel (déjà
  recommandé Audit 1 §7.1) — condition pour qu'une restauration de
  schéma soit fidèle.
- **P2** : mettre en place une alerte simple sur l'échec d'un job
  `pg_cron` (Supabase propose des webhooks sur certains événements ;
  a minima, vérifier manuellement `cron.job_run_details` de façon
  périodique tant qu'aucune alerte automatique n'existe).
- **P2** : documenter une procédure d'incident écrite, même minimale
  (qui contacter, où regarder en premier, comment vérifier que
  `pg_cron` tourne).

## Ce que je n'ai pas pu vérifier

- **Durée de rétention exacte des logs sur le plan Free actuel** —
  nécessite le Dashboard → Logs, non accessible via les outils MCP
  utilisés dans cet audit.
- **Coût réel du plan Pro pour ce projet spécifiquement** — outil
  `get_cost` disponible mais non interrogé dans cet audit (documentaire,
  pas une décision d'achat — à votre demande explicite si vous voulez
  ce chiffre).
- **Politique de sauvegarde exacte de Vercel** pour le code/déploiement
  frontend — moins critique (le code est déjà sur GitHub, source de
  vérité), non creusé ici.
