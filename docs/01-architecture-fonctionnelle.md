# 01 — Architecture fonctionnelle

## Modèle économique (rappel, structure la totalité du produit)

Le chauffeur paie un **abonnement à durée fixe** pour avoir le droit de recevoir
des courses — pas une commission par course.

| Plan | Durée | Prix | Statut MVP |
|---|---|---|---|
| Pass Jour | 24 h | 1 500 FCFA | **MVP** |
| Pass 7 jours | 7 j | à définir | Prévu, non actif au lancement |
| Pass 30 jours | 30 j | à définir | Prévu, non actif au lancement |

Règle centrale, valable pour toute la plateforme : **un chauffeur ne peut
recevoir aucune demande de course tant qu'il n'a pas d'abonnement actif**,
quel que soit son historique, sa note ou son ancienneté. Cette règle est
appliquée côté base de données (pas seulement côté interface) — voir
[06-schema-base-donnees.md](06-schema-base-donnees.md) et
[08-matching.md](08-matching.md).

Aucune commission n'est prélevée sur le prix de la course pendant la durée de
l'abonnement actif — le passager paie le chauffeur directement (cash) ou via
Mobile Money vers le chauffeur, sans reversement à la plateforme sur cette
transaction. Ce choix a une conséquence directe sur l'architecture : la
plateforme n'a pas besoin d'être dans la boucle de paiement de la course
elle-même pour le MVP (voir [10-paiements.md](10-paiements.md)) — seul le
paiement de l'abonnement chauffeur transite par la plateforme.

## Les trois domaines fonctionnels

```
┌─────────────────────────────────────────────────────────────┐
│                        PLATEFORME VTC                        │
├───────────────────┬───────────────────┬─────────────────────┤
│     PASSAGER       │     CHAUFFEUR      │      ADMIN          │
├───────────────────┼───────────────────┼─────────────────────┤
│ Compte & profil    │ Compte & KYC       │ Utilisateurs        │
│ Commande de course │ Véhicule           │ Chauffeurs & KYC     │
│ Suivi temps réel   │ Abonnement         │ Véhicules            │
│ Paiement           │ Disponibilité      │ Courses (suivi live) │
│ Historique & notes │ Courses reçues     │ Abonnements          │
│ SOS / signalement  │ Revenus            │ Paiements             │
│                     │ Statistiques       │ Tarification & zones │
│                     │                     │ Réclamations          │
│                     │                     │ Statistiques globales │
└───────────────────┴───────────────────┴─────────────────────┘
                              │
                 ┌────────────┴────────────┐
                 │   MOTEUR DE MATCHING     │
                 │   MOTEUR DE TARIFICATION │
                 └──────────────────────────┘
```

## Cycle de vie d'une course (vue fonctionnelle)

```
Passager                Plateforme                  Chauffeur
   │                         │                            │
   │─ position + destination ►                            │
   │◄─ estimation prix ──────│                             │
   │─ commande ──────────────►                            │
   │                         │─ recherche chauffeurs ──►  │
   │                         │  (abonnement actif requis)  │
   │                         │─ demande envoyée (rang 1) ─►│
   │                         │◄─ refus/expiration ────────│
   │                         │─ demande envoyée (rang 2) ─►│  (autre chauffeur)
   │                         │◄─ acceptation ──────────────│
   │◄─ chauffeur assigné ────│                             │
   │◄─ position temps réel ──│◄─ position temps réel ──────│
   │◄─ "chauffeur arrivé" ───│◄─ arrivée signalée ──────────│
   │◄─ "course démarrée" ────│◄─ départ signalé ────────────│
   │◄─ "course terminée" ────│◄─ fin signalée ──────────────│
   │─ paiement (cash/MoMo) ──┼────────────────────────────►│  (direct, sans commission)
   │─ notation ───────────────►                            │
```

## Règles métier transverses

- **Un compte, plusieurs casquettes possibles** : un même utilisateur peut
  être passager et, séparément, demander à devenir chauffeur (KYC dédié). Les
  deux profils sont indépendants dans les permissions (voir
  [11-securite.md](11-securite.md)).
- **Validation administrative obligatoire avant toute activité chauffeur** :
  documents soumis → statut `pending_review` → décision admin
  (`approved`/`rejected`). Un chauffeur `pending_review` ou `rejected` ne peut
  ni acheter d'abonnement actif pour recevoir des courses, ni apparaître dans
  le matching.
- **Disponibilité ≠ abonnement actif** : ce sont deux conditions cumulatives.
  Un chauffeur abonné mais qui a coupé sa disponibilité n'apparaît pas dans le
  matching ; un chauffeur disponible mais dont l'abonnement a expiré non plus.
- **Zone de lancement unique** : Lomé au démarrage. Le modèle de données
  (`zones`) est conçu pour ajouter une ville sans migration structurelle —
  voir [06-schema-base-donnees.md](06-schema-base-donnees.md) et
  [12-roadmap.md](12-roadmap.md).
- **Extensibilité prévue dès le MVP, non développée au MVP** : abonnements
  7j/30j, comptes professionnels (flottes), publicité, livraison, options de
  visibilité (mise en avant chauffeur), autres services de mobilité (moto-taxi
  notamment, très présent à Lomé). Le schéma de données et les enums sont
  choisis pour absorber ces extensions sans réécriture — voir chaque document
  concerné.

## Ce que le MVP fait et ne fait pas

**Fait** (détail écran par écran en [05-ecrans.md](05-ecrans.md)) :
inscription passager/chauffeur par téléphone + OTP, commande de course avec
estimation de prix, matching automatique séquentiel, suivi temps réel,
paiement cash et Mobile Money (chauffeur↔passager, hors plateforme) +
paiement Mobile Money de l'abonnement chauffeur (plateforme↔chauffeur),
historique, notation, SOS, dashboard admin complet sur les huit domaines listés
en §13 du cadrage initial.

**Ne fait pas au MVP** (voir [12-roadmap.md](12-roadmap.md) pour la suite) :
tarification dynamique/surge, abonnements 7j/30j actifs, comptes pro/flottes,
publicité, livraison de colis, moto-taxi, partage de trajet en direct avec un
tiers hors appli, chat texte in-app (le contact se fait par appel téléphonique
natif dans ce MVP — plus simple, plus fiable sur réseau faible, et déjà la
norme d'usage au Togo).
