# État du projet — VTC Togo

*Dernière mise à jour : 3 septembre 2026 (schéma complet déployé sur le
vrai projet Supabase, vérifié en conditions réelles)*

> Instantané, pas un journal — réécrit à chaque mise à jour significative.

## 1. Où en est-on ?

Après le cadrage (12 livrables) et le design UX/UI (37 écrans + design
system, canvas publié), le backend (schéma + logique métier + module
financier complet, deux catégories voiture/moto-taxi) a été écrit et
vérifié en local, puis **déployé pour de vrai** : les 4 migrations sont
appliquées sur un projet Supabase réel dédié à ce produit (distinct de
votre autre projet), collées par vos soins dans le SQL Editor (accès
réseau direct impossible depuis cet environnement), et **vérifiées
présentes** (32 tables, 49 fonctions, 13 triggers, 51 policies RLS,
6 plans d'abonnement — comptage confirmé identique à l'application locale,
hors triggers internes ajoutés par Supabase lui-même sur `auth.users`).
Reste à déployer : les 5 Edge Functions, le worker de dispatch, et à
initialiser les applications (mobile ×2, dashboard admin).

## 2. Ce qui fonctionne

**Base de données** (4 migrations dans `supabase/migrations/`), **vérifiée
de bout en bout avec des scénarios réels contre Postgres 16 + PostGIS**,
pas seulement relue :
- Cycle complet d'une course par catégorie : commande voiture/moto →
  matching **filtré par catégorie** → acceptation → arrivée → trajet → fin,
  cash ou Mobile Money.
- **Frais de service (2,5 %)** calculés une seule fois à la confirmation du
  paiement (`platform_fee_fcfa = round(prix × 2,5 %)`), jamais recalculés —
  vérifié numériquement sur plusieurs montants.
- **Paiement de course Mobile Money** (nouveau) : `complete_ride` crée un
  paiement `pending` et laisse la course en `payment_status='processing'` ;
  `confirm_ride_payment` (webhook fournisseur, `service_role`) vérifie
  montant et `ride_id` avant d'activer (`amount_mismatch`/
  `ride_id_mismatch` bien rejetés), et un `transaction_id` réutilisé sur un
  autre paiement est rejeté **au niveau base** (contrainte unique), pas
  seulement en application — confirmé par un test d'insertion qui échoue
  comme attendu. Un échec fournisseur (`admin_mark_payment_failed`)
  synchronise `rides.payment_status`, jamais de course bloquée en
  `'processing'`.
- **Facturation automatique** (trigger, déclenché uniquement si
  `completed` + `payment_status='success'`, confirmé absente tant que ce
  n'est pas le cas) et **règlement par lot** (`admin_create_settlement`/
  `admin_mark_settlement_paid`, double règlement rejeté) — testés de bout
  en bout pour les deux modes de paiement.
- **Remboursement** (`admin_refund_payment`, nouveau) : un paiement déjà
  remboursé ne peut pas l'être deux fois (vérifié) ; pour une course,
  `rides.payment_status='refunded'` exclut automatiquement la course des
  agrégats "succès" du reporting (vérifié : les frais de service et le
  volume du jour retombent à zéro après remboursement de la seule course
  du jour).
- **Reporting financier** (`admin_stats_overview`, étendu) : abonnement et
  frais de service toujours séparés, par catégorie ; volume de courses,
  paiements cash/Mobile Money, paiements échoués, remboursements, montant
  net chauffeur — les dix items demandés, jamais fusionnés entre eux.
- **Garde-fou catégorie** vérifié (`purchase_subscription` rejette un plan
  de la mauvaise catégorie).
- Le reste (KYC, anti-fraude, suspension de compte, support) : hérité des
  versions précédentes, non retesté ici car non touché par ce module.

**Edge Function `payment-webhook-momo`** : mise à jour pour router vers
`confirm_ride_payment` ou `confirm_subscription_payment` selon
`payments.purpose` — `deno check`/`deno lint` propres contre les vrais
types, jamais déployée faute de projet Supabase réel. Les 4 autres Edge
Functions et le worker de dispatch : non modifiés par ce module.

**Design** : 37 écrans (19 passager + 18 chauffeur) + design system, canvas
publié — **antérieur à la révision du modèle économique du 3 septembre**,
ne reflète pas les écrans documentés en [05-ecrans.md](05-ecrans.md)
(catégorie, factures, facturation/règlement/fraude admin). Doc 05
documente ~58 écrans désormais, canvas toujours à ~50.

## 3. Ce qui pose problème / limites connues

- **Edge Functions, worker de dispatch et applications pas encore
  déployés** — le schéma est en place mais rien ne l'utilise encore
  réellement (Auth, Realtime, Storage, `pg_cron`, webhooks pas encore
  exercés en conditions réelles). Accès réseau direct toujours impossible
  depuis cet environnement sandboxé — toute suite (Edge Functions
  comprises) demande soit que vous colliez le code dans le dashboard
  Supabase vous-même, soit un accès depuis votre propre machine/CLI.
- **Custody des fonds Mobile Money d'une course, non tranchée** : le
  mécanisme de webhook vérifié est construit et testé, mais que les fonds
  transitent réellement par un compte plateforme (API de collecte pour
  compte de tiers) ou soient un virement direct passager→chauffeur dont la
  plateforme n'est que spectatrice dépend du fournisseur retenu — question
  réglementaire à trancher avec vous avant production réelle (voir
  [10-paiements.md](10-paiements.md) §Paiement de la course).
- **`phone-verification-check` (ouverture de session après OTP)** reste le
  point le plus incertain du backend — jamais exécuté contre un vrai projet
  Supabase, à tester en priorité absolue dès qu'un projet est disponible.
- **Canvas de design non mis à jour** pour la révision du 3 septembre —
  passe à prévoir séparément.
- **Edge Function `pricing-directions`** ne transmet pas encore `category`
  à `estimate_ride_fare` — sans impact aujourd'hui (aucune app ne l'appelle
  encore), à corriger au moment de construire l'app passager.
- **Rendu PDF de la facture non construit** — seule la ligne de données
  `invoices` est produite.
- **Aucune application (mobile ou admin) initialisée** — seuls des dossiers
  avec README existent dans `apps/`/`packages/`.
- **Décisions fournisseurs non prises** : Google Maps vs Mapbox, choix
  Mobile Money (Flooz/TMoney/Semoa Togo) — voir §7. Le backend fonctionne
  déjà en mode paiement manuel sans attendre cette décision.
- **Critère de fiabilité du matching non implémenté** (taux
  d'acceptation/annulation du chauffeur) — documenté comme extension en
  doc 08.

Rien en cours — en attente de la prochaine demande.

## 5. Dernièrement terminé

**3 septembre 2026** :
- **Déploiement réel du schéma** : les 4 migrations collées dans le SQL
  Editor de votre projet Supabase dédié (37 morceaux, découpage automatique
  respectant les limites de collage et les frontières de fonctions/
  commentaires — un morceau initialement sauté par erreur, rattrapé).
  Compté et confirmé identique à l'application locale (32 tables,
  49 fonctions, 13 triggers dont 5 internes Supabase, 51 policies RLS,
  6 plans).
- **Révision du modèle économique** : deux catégories voiture/moto-taxi,
  abonnement 1 000/500 FCFA, frais de service 2,5 %/course, facturation
  automatique, règlement différé par lot — schéma, logique métier
  (`~40` fonctions désormais) et docs 01/03 à 12 mis à jour, vérifié contre
  Postgres 16 + PostGIS local.
- **Module paiement/abonnement/facturation** (suite directe, même jour) :
  paiement de course Mobile Money via webhook vérifié (montant, `ride_id`,
  anti-doublon `transaction_id` au niveau base), `confirm_ride_payment`,
  `admin_refund_payment`, `admin_mark_payment_failed` synchronisé,
  reporting financier complet dans `admin_stats_overview`, Edge Function
  `payment-webhook-momo` routée par `purpose`. Vérifié de bout en bout
  (montant/ride_id erronés rejetés, doublon de transaction rejeté par la
  contrainte base, remboursement idempotent, échec correctement
  synchronisé).
- Antérieurement (2 septembre 2026) : backend initial complet (schéma,
  ~35 fonctions, worker, 5 Edge Functions) — détail dans l'historique de
  conversation, non ré-explicité ici.

## 6. Prochaine étape

Suite de la Phase 0 de [`12-roadmap.md`](12-roadmap.md) : déployer les
5 Edge Functions (même méthode que les migrations — collées dans le
dashboard Supabase, section Edge Functions, secrets renseignés au passage :
`ESMS_AFRICA_API_KEY`, `PAYMENT_WEBHOOK_SECRET`, etc.), tester réellement
en priorité `phone-verification-check` (le point le plus incertain du
backend, jamais exécuté contre un vrai projet), puis déployer le worker de
dispatch (VPS + systemd). Décisions fournisseurs (§7) à prendre en
parallèle, non bloquantes pour ces étapes.

## 7. Décision(s) / action(s) requise(s) de votre part

- **Compte eSMS Africa** : à créer (distinct de celui de votre autre
  projet) — nécessaire pour que `phone-verification-start`/`-check`
  fonctionnent réellement une fois déployées.
- **Cartographie** : Google Maps Platform (recommandé, facturé à l'usage)
  ou Mapbox.
- **Mobile Money** : ordre de préférence entre Flooz (direct), TMoney
  (direct), Semoa Togo (agrégateur) — non bloquant, le backend fonctionne
  déjà en mode paiement manuel/admin. Le choix détermine aussi la réponse
  à la question de custody des fonds notée en §3.
- **Comptes développeur mobile** : Expo/EAS, Google Play Console, Apple
  Developer — non bloquant avant la Phase 9.
- **Régime fiscal togolais applicable à la facturation pour compte du
  chauffeur** et **statut réglementaire de la collecte Mobile Money pour
  compte de tiers** — à valider avant mise en production réelle (voir
  [01-architecture-fonctionnelle.md](01-architecture-fonctionnelle.md)
  §Rôle des parties et [10-paiements.md](10-paiements.md)).
