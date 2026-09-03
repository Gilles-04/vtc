# 11 — Règles de sécurité

## Authentification

- **OTP par téléphone** (eSMS Verify), même mécanisme éprouvé que MBONPLAN.
  Compte et clé API **distincts** de ceux de MBONPLAN (deux produits, deux
  comptes fournisseur).
- **Staff admin** : email + mot de passe (pas de compte auto-créé — un
  `super_admin` crée les comptes staff manuellement, jamais d'auto-inscription
  admin).
- Jetons de session gérés par Supabase Auth (refresh automatique), aucune
  gestion de session maison.

## Rôles et permissions

| Rôle | Portée |
|---|---|
| `passenger` | Ses propres courses, paiements de course (déclaratifs), notes données/reçues, signalements créés |
| `driver` | Son propre dossier KYC/véhicule, ses abonnements/paiements, les offres de course qui lui sont adressées, les courses où il est assigné |
| `admin` (staff) | Selon `admin_roles.role` : `support` (utilisateurs, réclamations, SOS), `finance` (paiements, abonnements, statistiques financières), `admin` (KYC, courses, tarification, zones), `super_admin` (tout + gestion des comptes staff) |

Toute vérification de rôle admin passe par une fonction `SECURITY DEFINER`
qui interroge `admin_roles` — jamais une policy RLS ouverte à
`authenticated`. Un chauffeur et un passager ne partagent **aucune**
politique RLS commune qui exposerait les données de l'autre : les policies
sont écrites par table et par rôle, pas génériques.

**Suspension effective, pas juste un drapeau** : `admin_suspend_user` pose
`profiles.is_suspended`, et `private.assert_not_suspended()` est appelée en
première ligne de chaque action sensible côté client (`create_ride_request`,
`set_driver_availability`, `purchase_subscription`, `create_support_ticket`)
— confirmé par un test réel : un compte suspendu voit sa demande de course
rejetée (`account_suspended`) avant même la moindre écriture.

## RLS — principes appliqués table par table

- `profiles` : lecture/écriture limitées à `auth.uid() = id`, sauf staff admin.
- `drivers`, `driver_documents`, `vehicles` : accès complet uniquement au
  chauffeur propriétaire + staff admin habilité. Un passager n'a **aucun**
  accès direct à ces tables — les informations affichées côté passager
  (nom, note, véhicule) passent par une fonction dédiée qui ne renvoie que
  les champs publics nécessaires, jamais la ligne complète.
- `rides` : un passager voit ses propres lignes ; un chauffeur voit les
  lignes où il est `driver_id` ; le staff admin voit tout via fonction dédiée.
- `ride_offers` : un chauffeur ne voit que ses propres offres, jamais celles
  envoyées aux autres candidats (ne doit pas pouvoir déduire qui d'autre a
  été sollicité).
- `driver_locations` : écriture réservée au chauffeur, pour sa propre
  ligne ; lecture limitée à lui-même, au passager de la course en cours
  (si `ride_id` renseigné), et au staff admin.
- `payments`, `subscriptions` : lecture limitée au chauffeur propriétaire +
  staff `finance`/`admin`/`super_admin`. Écriture uniquement via fonctions
  serveur (`SECURITY DEFINER` + Edge Functions avec la clé de service),
  jamais en direct depuis le client — **vérifié réellement** : aucune
  policy d'écriture cliente n'existe sur ces deux tables (migration 1).
- `settlements` : lecture limitée au chauffeur concerné + staff
  `finance`/`admin`/`super_admin`. `invoices` : lecture limitée au passager
  et au chauffeur de la course + même staff. Aucune écriture cliente sur
  les deux — `settlements` n'est créée/modifiée que par
  `admin_create_settlement`/`admin_mark_settlement_paid`, `invoices`
  uniquement par le trigger `generate_invoice_on_ride_success`.
- `admin_roles` : lecture/écriture réservées à `super_admin`.
- `audit_logs` : écriture uniquement via fonctions serveur, lecture réservée
  au staff admin.

## Documents KYC

- Bucket Storage **privé** (`driver-documents`), jamais d'URL publique —
  accès exclusivement par URL signée à durée limitée, générée à la demande
  (même principe que le bucket `hr-files` de MBONPLAN).
- Un chauffeur ne peut voir/remplacer que ses propres documents.
- Toute décision (approbation/rejet) est tracée dans `audit_logs` avec
  l'identité du staff, l'horodatage et le motif.

## Anti-fraude

Trois mécanismes complémentaires, **implémentés et vérifiés** contre un
Postgres local (migration `00000000000002_business_logic.sql`) — jamais
de blocage automatique silencieux, toujours une file de revue humaine :

- **Comptes multiples / appareils partagés** — `device_fingerprints`
  (`user_id`, `device_id` déclaré par le client). Un même `device_id`
  associé à plus d'un compte déclenche automatiquement (trigger) un
  signalement dans `fraud_flags` (`subject_type='device'`), sévérité
  croissante avec le nombre de comptes liés. Confirmé par un test réel :
  deux comptes déclarant le même appareil produisent bien un signalement.
- **Anomalie de position GPS** — `update_driver_location()` compare
  chaque nouveau point à la position précédente du même chauffeur ; une
  vitesse implicite supérieure à 150 km/h (survolant tout mode de
  déplacement urbain plausible) déclenche un signalement
  (`subject_type='driver'`), sévérité `high` au-delà de 400 km/h
  (téléportation manifeste). Confirmé par un test réel (saut de ~80 km en
  quelques millisecondes entre deux appels).
- **Limitation de débit** (`private.enforce_rate_limit`, table interne
  `rate_limit_counters`, fenêtre fixe) sur les actions à coût ou à risque
  d'abus : demande de code SMS (5/heure/numéro), création de course
  (5/5 min/passager), achat d'abonnement (10/heure/chauffeur), ticket
  support (10/heure/compte). Confirmé par un test réel : une 6ᵉ demande de
  course en moins de 5 minutes est bien rejetée (`rate_limit_exceeded`).

Toute entrée dans `fraud_flags` (statut `open`/`reviewing`/`confirmed`/
`dismissed`) attend une décision `admin_resolve_fraud_flag` — jamais de
suspension ou de blocage déclenché automatiquement par ces signaux seuls.

**Distinct, non redondant** : détection de doublons *documentaires*
(numéro de pièce d'identité ou plaque d'immatriculation identique sur
plusieurs dossiers `driver_documents`/`vehicles` — contrainte unique déjà
en place sur `plate_number`, vérification manuelle assistée pour les
pièces d'identité). L'OCR/reconnaissance automatique de document reste une
extension hors MVP, voir [12-roadmap.md](12-roadmap.md).

Un numéro de téléphone = un compte (contrainte native de l'auth par
téléphone) — première ligne de défense, avant même ces trois mécanismes.

## SOS et signalement

- Le bouton SOS crée une `sos_alerts` **et** notifie immédiatement le
  dashboard admin en priorité maximale (Realtime, pas seulement une
  notification classique) — voir parcours admin en
  [04-parcours-utilisateur.md](04-parcours-utilisateur.md).
- La position exacte au moment du déclenchement est capturée et jamais
  recalculée après coup.
- Le partage de trajet (position + infos course envoyées à un tiers hors
  appli, ex. par lien) est prévu dans le modèle de données
  (`rides` porte tout le nécessaire) mais son implémentation (génération de
  lien, page de suivi publique limitée) est documentée comme extension
  proche, pas MVP strict — voir [12-roadmap.md](12-roadmap.md).

## Chiffrement et transport

- TLS partout (Supabase impose HTTPS ; apps mobiles n'acceptent que des
  origines HTTPS/`https://<projet>.supabase.co`).
- Données sensibles au repos : chiffrement natif Postgres/Supabase au niveau
  stockage ; aucune donnée de paiement brute (numéro de carte — non
  applicable ici, Mobile Money n'en manipule pas côté plateforme) stockée.
- Clés API fournisseurs (Maps, SMS, Mobile Money) exclusivement côté
  serveur/Edge Functions, jamais embarquées dans le bundle mobile — seule la
  clé Maps **restreinte par plateforme/bundle ID** peut légitimement vivre
  côté client (nécessaire au rendu de carte), toutes les autres non.

## Logs et audit

- `audit_logs` couvre : décisions KYC, suspensions/réactivations de compte,
  confirmations manuelles de paiement, modifications de tarification/zones,
  résolutions de réclamation/SOS.
- Logs serveur (Edge Functions) transmis à un webhook de supervision
  (`MONITORING_WEBHOOK_URL`, même principe que MBONPLAN) pour les erreurs
  critiques (échec de matching, échec de confirmation de paiement).

## Ce qui reste une décision produit, pas uniquement technique

- Politique de suppression de compte (délai de rétention légal avant purge
  définitive) — à définir avec vous avant la mise en production réelle,
  cohérent avec la réglementation togolaise applicable aux données
  personnelles.
- Conservation des positions GPS (`driver_locations`) : durée de rétention
  à fixer (utile pour litiges à court terme, coûteux à conserver
  indéfiniment à grande échelle).
