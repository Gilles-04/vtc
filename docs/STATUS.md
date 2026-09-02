# État du projet — VTC Togo

*Dernière mise à jour : 2 septembre 2026 (backend complet écrit et vérifié en local)*

> Instantané, pas un journal — réécrit à chaque mise à jour significative.

## 1. Où en est-on ?

Après le cadrage (12 livrables) et le design UX/UI complet (37 écrans +
design system, canvas publié), le backend est maintenant **écrit et
vérifié en local** : schéma de données complet (29 tables), toute la
logique métier (matching, abonnement, courses, anti-fraude, support),
5 Edge Functions et un worker de dispatch. **Rien n'est encore déployé** —
aucun projet Supabase réel n'existe pour ce produit, tout a été testé
contre des instances Postgres/Deno/Node locales, jetables, créées et
détruites pour l'occasion.

## 2. Ce qui fonctionne

**Base de données** (4 migrations dans `supabase/migrations/`, testées de
bout en bout avec 25 vérifications automatisées, pas seulement relues) :
cycle complet d'une course (création → matching séquentiel avec
élargissement de rayon → acceptation → arrivée → trajet → fin → notation
avec agrégat automatique) ; abonnement (achat avec code promo → paiement →
confirmation manuelle → activation/prolongation → expiration automatique
par `pg_cron` → blocage du chauffeur) ; dossier chauffeur (soumission →
décision admin → notification) ; anti-fraude (appareil partagé entre
comptes, anomalie de vitesse GPS, limitation de débit — tout confirmé par
des tests réels, y compris les rejets attendus) ; suspension de compte
avec blocage effectif ; ticket support avec fil de messages ; sécurité
vérifiée activement (une fonction interne appelée directement par un
client authentifié échoue bien avec `permission denied`).

**Worker de dispatch** (`services/matching-worker/`) : processus Node.js
compilé, testé pour de vrai contre un Postgres local (offre expirée
artificiellement → balayée et relancée au cycle suivant).

**Edge Functions** (`supabase/functions/`, 5 fonctions) : écrites,
vérifiées avec Deno réel (`deno check` contre les vrais types
`@supabase/supabase-js`, `deno lint`) — jamais déployées ni appelées
contre un vrai projet Supabase.

**Design** : 37 écrans (19 passager + 18 chauffeur) + design system,
canvas publié (lien dans l'historique de conversation).

## 3. Ce qui pose problème / limites connues

- **Aucun projet Supabase réel créé** — bloquant pour toute vérification
  en conditions réelles (Auth, Realtime, Storage, `pg_cron`, déploiement
  des Edge Functions).
- **`phone-verification-check` (ouverture de session après OTP) est le
  point le plus incertain du backend** — mécanisme standard documenté par
  la communauté Supabase (mot de passe aléatoire à usage unique côté
  serveur), types vérifiés contre la vraie bibliothèque, mais jamais
  exécuté contre un vrai projet Supabase. À tester en priorité absolue dès
  qu'un projet est disponible (voir l'avertissement en tête du fichier).
- **Aucune application (mobile ou admin) initialisée** — seuls des
  dossiers avec README existent dans `apps/`/`packages/`.
- **Décisions fournisseurs non prises** : Google Maps vs Mapbox, choix
  Mobile Money (Flooz/TMoney/Semoa Togo) — voir §7. Le backend fonctionne
  déjà en mode paiement manuel sans attendre cette décision.
- **Critère de fiabilité du matching non implémenté** (taux
  d'acceptation/annulation du chauffeur) — documenté comme extension en
  doc 08, colonnes à ajouter.

Rien en cours — en attente de la prochaine demande.

## 5. Dernièrement terminé

**2 septembre 2026** — Backend complet : schéma étendu de 20 à 29 tables
(ajout `passengers`, `ride_status_history`, `driver_locations` unifiée,
`support_tickets`/`messages`, `promotions`/`redemptions`,
`device_fingerprints`, `fraud_flags`, `rate_limit_counters`,
`phone_verifications` ; renommage `driver_subscriptions` → `subscriptions`
pour correspondre au schéma cible demandé) ; ~35 fonctions SQL
(`SECURITY DEFINER`) couvrant KYC, matching, abonnement, paiement,
support, modération, anti-fraude, statistiques ; 5 triggers automatiques
(historique de statut, agrégat de notation, compteur de promotion,
détection d'appareil partagé, notification SOS) ; worker de dispatch
Node.js ; 5 Edge Functions Deno. Deux bugs SQL réels trouvés et corrigés
en testant (pas en relisant) : un `record` PL/pgSQL jamais assigné
déréférencé (`_promo.id`) dans `purchase_subscription`, et une expression
`CASE` littérale mal typée assignée à une colonne enum
(`ride_status`/`fraud_severity`) dans trois fonctions.

Design UX/UI (19 écrans passager, 18 chauffeur, design system) et cadrage
initial (12 livrables) : voir historique de conversation pour le détail,
non ré-explicité ici.

## 6. Prochaine étape

Décisions fournisseurs (§7) puis Phase 0 de
[`12-roadmap.md`](12-roadmap.md) : création du vrai projet Supabase,
application des 4 migrations, déploiement des Edge Functions, test réel
en priorité de `phone-verification-check`, déploiement du worker de
dispatch (VPS + systemd, unité fournie dans
`services/matching-worker/systemd/`).

## 7. Décision(s) / action(s) requise(s) de votre part

- **Cartographie** : Google Maps Platform (recommandé, facturé à l'usage)
  ou Mapbox.
- **Mobile Money** : ordre de préférence entre Flooz (direct), TMoney
  (direct), Semoa Togo (agrégateur) — non bloquant, le backend fonctionne
  déjà en mode paiement manuel/admin.
- **Compte Supabase** : à créer (ou fournir l'accès) pour ouvrir le projet
  dédié à ce produit — première étape qui débloque toute vérification en
  conditions réelles.
- **Comptes développeur mobile** : Expo/EAS, Google Play Console, Apple
  Developer — non bloquant avant la Phase 9.
