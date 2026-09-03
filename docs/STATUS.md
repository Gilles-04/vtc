# État du projet — VTC Togo

*Dernière mise à jour : 3 septembre 2026 (révision du modèle économique
appliquée au backend + docs, vérifiée en local)*

> Instantané, pas un journal — réécrit à chaque mise à jour significative.

## 1. Où en est-on ?

Après le cadrage (12 livrables) et le design UX/UI (37 écrans + design
system, canvas publié), le backend a été **entièrement revu** pour
refléter la révision du modèle économique du 3 septembre 2026 : deux
catégories de conducteurs (voiture/moto-taxi), deux revenus distincts
(abonnement + frais de service de 2,5 %/course), facturation automatique,
règlement différé par lot. Schéma, logique métier et docs sont à jour et
**vérifiés en local** (Postgres/PostGIS jetable) — **rien n'est encore
déployé**, aucun projet Supabase réel n'existe pour ce produit.

## 2. Ce qui fonctionne

**Base de données** (4 migrations dans `supabase/migrations/`), **vérifiée
de bout en bout avec des scénarios réels contre Postgres 16 + PostGIS**,
pas seulement relue :
- Cycle complet d'une course par catégorie : commande voiture/moto →
  matching **filtré par catégorie** (confirmé : un chauffeur moto disponible
  ne reçoit jamais une offre voiture, et inversement) → acceptation →
  arrivée → trajet → fin avec confirmation de paiement.
- **Frais de service (2,5 %)** calculés une seule fois à `complete_ride`
  (`platform_fee_fcfa = round(prix × 2,5 %)`), jamais recalculés — vérifié
  numériquement (1 405 FCFA → 35 FCFA de frais, 1 370 FCFA pour le
  chauffeur).
- **Facturation automatique** (trigger `generate_invoice_on_ride_success`,
  déclenché uniquement si `completed` + `payment_status='success'`) et
  **règlement par lot** (`admin_create_settlement`/`admin_mark_settlement_paid`,
  double règlement sur une même période bien rejeté) — testés de bout en
  bout.
- **Séparation des deux revenus** vérifiée dans `admin_stats_overview()`
  (clés distinctes abonnement/frais de service, par catégorie, jamais
  additionnées) et **garde-fou catégorie** vérifié (`purchase_subscription`
  rejette un plan de la mauvaise catégorie).
- Le reste (KYC, anti-fraude, suspension de compte, support) : hérité de la
  version précédente, non retesté ici car non touché par cette révision.

**Worker de dispatch** (`services/matching-worker/`) et **Edge Functions**
(`supabase/functions/`, 5 fonctions) : non modifiés par cette révision
(le worker appelle une fonction générique, les Edge Functions ne
connaissent pas encore la catégorie/facturation — `pricing-directions`
devra transmettre `category` une fois les apps construites, noté comme
point d'attention ci-dessous plutôt qu'un bug).

**Design** : 37 écrans (19 passager + 18 chauffeur) + design system, canvas
publié (lien dans l'historique de conversation) — **antérieur à cette
révision**, ne reflète pas encore les nouveaux écrans documentés en
[05-ecrans.md](05-ecrans.md) (choix catégorie, factures, écrans admin
facturation/règlement/fraude). Doc 05 documente ~58 écrans désormais,
canvas toujours à ~50.

## 3. Ce qui pose problème / limites connues

- **Aucun projet Supabase réel créé** — bloquant pour toute vérification en
  conditions réelles (Auth, Realtime, Storage, `pg_cron`, déploiement des
  Edge Functions). Confirmé cette session : même l'accès réseau HTTPS vers
  `*.supabase.co`/`api.supabase.com` est bloqué depuis cet environnement
  sandboxé (politique réseau de l'organisation) — toute vérification réelle
  demande soit que vous colliez les migrations dans le SQL Editor Supabase
  vous-même, soit un accès depuis votre propre machine/CLI.
- **`phone-verification-check` (ouverture de session après OTP)** reste le
  point le plus incertain du backend — jamais exécuté contre un vrai projet
  Supabase, à tester en priorité absolue dès qu'un projet est disponible.
- **Canvas de design non mis à jour** pour cette révision (voir §2) — passe
  à prévoir séparément, volontairement pas traitée dans cette révision.
- **Edge Function `pricing-directions`** ne transmet pas encore `category`
  à `estimate_ride_fare` — sans impact aujourd'hui (aucune app ne l'appelle
  encore), mais à corriger au moment de construire l'app passager.
- **Rendu PDF de la facture non construit** — seule la ligne de données
  `invoices` est produite (voir [10-paiements.md](10-paiements.md)
  §Facturation).
- **Aucune application (mobile ou admin) initialisée** — seuls des dossiers
  avec README existent dans `apps/`/`packages/`.
- **Décisions fournisseurs non prises** : Google Maps vs Mapbox, choix
  Mobile Money (Flooz/TMoney/Semoa Togo) — voir §7. Le backend fonctionne
  déjà en mode paiement manuel sans attendre cette décision.
- **Critère de fiabilité du matching non implémenté** (taux
  d'acceptation/annulation du chauffeur) — documenté comme extension en
  doc 08, colonnes à ajouter.

Rien en cours — en attente de la prochaine demande.

## 5. Dernièrement terminé

**3 septembre 2026** — Révision complète du modèle économique (deux
catégories voiture/moto-taxi, abonnement 1 000/500 FCFA, frais de service
2,5 %/course, facturation automatique, règlement différé par lot) :
- `docs/01-architecture-fonctionnelle.md` réécrit (nouveau modèle, rôle des
  parties chauffeur=transporteur/plateforme=prestataire technique).
- Migration 1 (structure) : nouveaux enums `driver_category`/
  `settlement_status`, `payment_status` étendu, `ride_status` aligné sur la
  liste exacte demandée (`driver_arrived` remplace `arrived`,
  `cancelled_by_system` remplace `no_drivers_found`) ; colonne `category`
  sur `drivers`/`subscription_plans`/`pricing_rules`/`rides` ; nouvelles
  tables `settlements`/`invoices` + RLS ; suppression du chemin d'insertion
  directe (mort) sur `drivers` ; seed remplacé par 6 plans par catégorie.
- Migration 2 (logique métier) : `submit_driver_application`/
  `estimate_ride_fare`/`create_ride_request` prennent désormais `category` ;
  `dispatch_next_offer` filtre par catégorie et utilise
  `cancelled_by_system` ; `complete_ride` calcule les frais de service et
  accepte `payment_confirmed` ; nouveau trigger
  `generate_invoice_on_ride_success` ; nouvelles fonctions
  `admin_create_settlement`/`admin_mark_settlement_paid` ; `purchase_subscription`
  refuse un plan de la mauvaise catégorie ; `admin_stats_overview` sépare
  les deux revenus par catégorie.
- **Vérifié réellement** contre un Postgres 16 + PostGIS local (voir §2
  pour le détail des scénarios) — pas seulement relu.
- Docs 03/04/05/06/07/08/09/10/11 mis à jour pour rester cohérents avec le
  nouveau schéma/API (signatures de fonctions, statuts, écrans, sitemap,
  README).

**2 septembre 2026** — Backend complet (version précédente, avant cette
révision) : schéma étendu de 20 à 29 tables, ~35 fonctions SQL, 5 triggers,
worker de dispatch, 5 Edge Functions — voir l'historique de conversation ou
`CHANGELOG.md` (à créer si le détail daté doit être conservé au-delà de ce
qui précède) pour le détail complet de cette étape.

## 6. Prochaine étape

Décisions fournisseurs (§7) puis Phase 0 de
[`12-roadmap.md`](12-roadmap.md) : création du vrai projet Supabase,
application des 4 migrations, déploiement des Edge Functions (en
transmettant `category` depuis `pricing-directions`), test réel en
priorité de `phone-verification-check`, déploiement du worker de dispatch
(VPS + systemd, unité fournie dans `services/matching-worker/systemd/`).
Une passe de mise à jour du canvas de design (nouveaux écrans catégorie/
facturation/règlement) reste à planifier séparément.

## 7. Décision(s) / action(s) requise(s) de votre part

- **Cartographie** : Google Maps Platform (recommandé, facturé à l'usage)
  ou Mapbox.
- **Mobile Money** : ordre de préférence entre Flooz (direct), TMoney
  (direct), Semoa Togo (agrégateur) — non bloquant, le backend fonctionne
  déjà en mode paiement manuel/admin.
- **Compte Supabase** : à créer (ou fournir l'accès) pour ouvrir le projet
  dédié à ce produit — première étape qui débloque toute vérification en
  conditions réelles. Un accès direct depuis cet environnement n'est pas
  possible (réseau bloqué) : soit vous appliquez les migrations vous-même
  via le SQL Editor Supabase, soit l'accès se fait depuis votre machine/CLI.
- **Comptes développeur mobile** : Expo/EAS, Google Play Console, Apple
  Developer — non bloquant avant la Phase 9.
- **Régime fiscal togolais applicable à la facturation pour compte du
  chauffeur** — à valider avant mise en production réelle (voir
  [01-architecture-fonctionnelle.md](01-architecture-fonctionnelle.md)
  §Rôle des parties et [10-paiements.md](10-paiements.md) §Facturation).
