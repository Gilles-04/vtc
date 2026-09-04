# 01 — Architecture fonctionnelle

## Modèle économique (rappel, structure la totalité du produit)

**Révisé le 3 septembre 2026** — remplace la version initiale (abonnement
seul, 0 % de commission). Le modèle officiel a **deux revenus distincts,
jamais mélangés** entre eux, dans le code comme dans les rapports :

1. **Abonnement** — le chauffeur paie pour avoir le droit de recevoir des
   courses pendant 24 h.
2. **Frais de service de plateforme et de gestion de facturation** —
   2,5 % prélevés sur **chaque course**, jamais au forfait, jamais par
   jour. Ce n'est pas une commission au sens d'une part du prix du
   transport que la plateforme s'attribuerait comme transporteur : c'est
   la rémunération du service technique (mise en relation, calcul du
   prix, facturation) — voir §Rôle des parties ci-dessous.

| Catégorie | Abonnement / 24 h | Frais de service / course |
|---|---|---|
| Voiture (VTC) | **1 000 FCFA** | **2,5 %** du prix de la course |
| Moto-taxi | **300 FCFA** | **2,5 %** du prix de la course |

**Règle absolue, ne jamais modifier sans instruction explicite** (rappelée
telle quelle dans chaque document technique concerné — schéma, paiements,
API) : ces deux chiffres et ce pourcentage sont fixes. Le 2,5 % s'applique
dès le lancement, sur chaque course, aux deux catégories. (Moto-taxi
corrigé de 500 à 300 FCFA le 4 septembre 2026 — chiffre confirmé par le
porteur du projet, le précédent n'avait jamais été validé.)

**Tarif de la course elle-même** (`pricing_rules`, distinct de
l'abonnement ci-dessus), confirmé le 4 septembre 2026 :

| Catégorie | Prise en charge | Prix/km | Prix/min | Minimum | Majoration nuit |
|---|---|---|---|---|---|
| Voiture (VTC) | 250 FCFA | 250 FCFA | — | 700 FCFA | +10 % (22h-5h) |
| Moto-taxi | 100 FCFA | 70 FCFA | — | aucun | +10 % (22h-5h) |

Règle centrale inchangée, valable pour toute la plateforme : **un
chauffeur ne peut recevoir aucune demande de course tant qu'il n'a pas
d'abonnement actif** dans sa catégorie, quel que soit son historique, sa
note ou son ancienneté. Appliquée côté base de données, pas seulement
côté interface — voir [06-schema-base-donnees.md](06-schema-base-donnees.md)
et [08-matching.md](08-matching.md).

### Comment les frais de service sont réellement perçus

Le prix de la course continue de se régler **directement entre le
passager et le chauffeur** (cash ou Mobile Money pair-à-pair) — la
plateforme ne s'interpose pas dans ce paiement au MVP (aucun fournisseur
de paiement choisi capable d'encaisser puis reverser, voir
[10-paiements.md](10-paiements.md)). Les 2,5 % dus par le chauffeur sur
chaque course s'accumulent donc comme une créance de la plateforme envers
lui, réglée périodiquement (**règlement**, table `settlements`) plutôt
qu'instantanément à chaque course. C'est un choix MVP assumé, pas un
oubli — documenté comme point d'évolution en
[10-paiements.md](10-paiements.md) et [12-roadmap.md](12-roadmap.md) une
fois un fournisseur capable d'encaisser pour le compte de la plateforme
retenu.

## Rôle des parties

Le **chauffeur est le prestataire du transport** — c'est lui qui rend le
service, encaisse le prix de la course, en est responsable vis-à-vis du
passager. **VTC Togo est la plateforme technologique** : mise en
relation, réservation, calcul du prix, géolocalisation, matching, suivi
GPS, paiement de l'abonnement, historique, gestion administrative, et
**gestion de la facturation pour le compte du chauffeur** (génération du
document, pas la relation contractuelle de transport elle-même).

Cette distinction structure directement l'architecture : nulle part
l'interface ne doit présenter VTC Togo comme le transporteur. Le
document de facturation généré après chaque course (voir
[10-paiements.md](10-paiements.md) §Facturation) porte le chauffeur comme
prestataire du transport et la plateforme comme émettrice du document
pour son compte — un mécanisme à concevoir de façon compatible avec la
réglementation togolaise applicable (point à valider avec vous avant mise
en production réelle, voir [12-roadmap.md](12-roadmap.md)).

## Deux catégories de conducteurs

**Voiture (VTC)** et **Moto-taxi** sont deux catégories parallèles, pas
une hiérarchie : un chauffeur choisit sa catégorie à l'inscription
(`drivers.category`), et cette catégorie détermine son plan d'abonnement,
sa tarification, et le pool de matching auquel il appartient — un
passager qui commande une course « voiture » ne voit jamais un candidat
moto, et inversement. Le passager choisit la catégorie **avant**
l'estimation de prix (voir [04-parcours-utilisateur.md](04-parcours-utilisateur.md)).

## Les trois domaines fonctionnels

```
┌─────────────────────────────────────────────────────────────┐
│                        PLATEFORME VTC                        │
├───────────────────┬───────────────────┬─────────────────────┤
│     PASSAGER       │     CHAUFFEUR      │      ADMIN          │
├───────────────────┼───────────────────┼─────────────────────┤
│ Compte & profil    │ Compte & KYC       │ Utilisateurs        │
│ Choix voiture/moto │ Catégorie + véhicule│ Chauffeurs & KYC    │
│ Commande de course │ Abonnement          │ Véhicules            │
│ Suivi temps réel   │ Disponibilité       │ Courses (suivi live) │
│ Paiement           │ Courses reçues      │ Abonnements           │
│ Facture/reçu       │ Revenus + frais dus │ Paiements & factures  │
│ Historique & notes │ Statistiques        │ Règlements (2,5 %)    │
│ SOS / signalement  │                     │ Tarification & zones  │
│                     │                     │ Réclamations           │
│                     │                     │ Statistiques globales  │
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
   │─ voiture ou moto ───────►                            │
   │─ position + destination ►                            │
   │◄─ estimation prix ──────│ (verrouillé dès confirmation)
   │─ commande ──────────────►                            │
   │                         │─ recherche chauffeurs ──►  │  (même catégorie,
   │                         │  (abonnement actif requis)  │   abonnement actif)
   │                         │─ demande envoyée (rang 1) ─►│
   │                         │◄─ refus/expiration ────────│
   │                         │─ demande envoyée (rang 2) ─►│  (autre candidat)
   │                         │◄─ acceptation ──────────────│
   │◄─ chauffeur assigné ────│                             │
   │◄─ position temps réel ──│◄─ position temps réel ──────│
   │◄─ "chauffeur arrivé" ───│◄─ arrivée signalée ──────────│
   │◄─ "course démarrée" ────│◄─ départ signalé ────────────│
   │◄─ "course terminée" ────│◄─ fin signalée + paiement confirmé │
   │─ paiement (cash/MoMo) ──┼────────────────────────────►│  (direct, prix figé)
   │                         │─ facture générée automatiquement (course terminée + paiement confirmé) │
   │                         │─ frais de service (2,5 %) crédités à la créance du chauffeur │
   │─ notation ───────────────►                            │
```

## Règles métier transverses

- **Un compte, plusieurs casquettes possibles** : un même utilisateur peut
  être passager et, séparément, demander à devenir chauffeur (KYC dédié,
  catégorie choisie à ce moment-là). Les deux profils sont indépendants
  dans les permissions (voir [11-securite.md](11-securite.md)).
- **Validation administrative obligatoire avant toute activité chauffeur** :
  documents soumis → statut `pending_review` → décision admin
  (`approved`/`rejected`). Un chauffeur `pending_review` ou `rejected` ne peut
  ni acheter d'abonnement actif pour recevoir des courses, ni apparaître dans
  le matching.
- **Disponibilité ≠ abonnement actif** : ce sont deux conditions cumulatives.
  Un chauffeur abonné mais qui a coupé sa disponibilité n'apparaît pas dans le
  matching ; un chauffeur disponible mais dont l'abonnement a expiré non plus.
- **Prix verrouillé dès la confirmation** : le prix affiché avant
  confirmation (distance, tarif/km de la catégorie, éventuelle majoration
  nuit) est figé sur la course dès sa création. Le chauffeur ne peut ni le
  modifier, ni ajouter de frais après coup — la distance, le tarif
  appliqué et le prix restent ceux calculés au moment de la réservation.
- **Zone de lancement unique** : Lomé au démarrage. Le modèle de données
  (`zones`) est conçu pour ajouter une ville sans migration structurelle —
  voir [06-schema-base-donnees.md](06-schema-base-donnees.md) et
  [12-roadmap.md](12-roadmap.md).
- **Extensibilité prévue dès le MVP, non développée au MVP** : abonnements
  7j/30j (par catégorie), comptes professionnels (flottes), publicité,
  livraison, options de visibilité (mise en avant chauffeur). Le schéma de
  données et les enums sont choisis pour absorber ces extensions sans
  réécriture — voir chaque document concerné.

## Ce que le MVP fait et ne fait pas

**Fait** (détail écran par écran en [05-ecrans.md](05-ecrans.md) — **à
mettre à jour** pour le choix de catégorie et les nouveaux écrans de
facturation/frais, voir [docs/STATUS.md](STATUS.md)) : inscription
passager/chauffeur par email + code (révisé le 3 septembre 2026, voir
[02-architecture-technique.md](02-architecture-technique.md) §Révision
authentification — plus de SMS OTP), choix voiture/moto, commande de
course avec estimation de prix par catégorie, matching automatique
séquentiel filtré par catégorie, suivi temps réel, paiement cash et
Mobile Money (chauffeur↔passager, hors plateforme) + paiement Mobile
Money de l'abonnement chauffeur (plateforme↔chauffeur), facturation
automatique après course terminée et payée, frais de service de 2,5 %
suivis par course et réglés périodiquement, historique, notation, SOS,
dashboard admin complet.

**Ne fait pas au MVP** (voir [12-roadmap.md](12-roadmap.md) pour la
suite) : tarification dynamique/surge, abonnements 7j/30j actifs, comptes
pro/flottes, publicité, livraison de colis, encaissement du prix de la
course par la plateforme (règlement différé des 2,5 % en attendant),
génération effective du PDF de facture (la ligne de facturation est créée
automatiquement en base, le rendu PDF reste à construire), partage de
trajet en direct avec un tiers hors appli, chat texte in-app (appel
téléphonique natif).
