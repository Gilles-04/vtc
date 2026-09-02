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
- `ride_locations` : écriture réservée au chauffeur assigné à la course
  active ; lecture limitée au passager de cette course, au chauffeur
  lui-même, et au staff admin.
- `payments`, `driver_subscriptions` : lecture limitée au chauffeur
  propriétaire + staff `finance`/`admin`/`super_admin`. Écriture uniquement
  via fonctions serveur (Edge Functions avec la clé de service), jamais en
  direct depuis le client.
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

## Protection contre les faux comptes / comptes multiples

- Un numéro de téléphone = un compte (contrainte native de l'auth par
  téléphone).
- Détection de doublons chauffeur : alerte admin si un même numéro de pièce
  d'identité ou une même plaque d'immatriculation apparaît sur plusieurs
  dossiers `driver_documents`/`vehicles` (contrainte unique sur
  `plate_number`, vérification manuelle assistée pour les pièces d'identité
  — l'OCR/reconnaissance automatique de document est une extension hors
  MVP, voir [12-roadmap.md](12-roadmap.md)).
- Limitation de débit (`rate limiting`) sur les endpoints sensibles :
  demande d'OTP, tentative de code, création de course, achat d'abonnement —
  au niveau Edge Function / Supabase (déjà natif pour l'OTP côté Auth).

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
- Conservation des positions GPS (`ride_locations`) : durée de rétention à
  fixer (utile pour litiges à court terme, coûteux à conserver indéfiniment
  à grande échelle).
