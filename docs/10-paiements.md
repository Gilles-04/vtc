# 10 — Logique des paiements

## Trois flux financiers bien distincts

**Révisé le 3 septembre 2026** — conséquence directe du modèle économique
(§1, rappelé en [01-architecture-fonctionnelle.md](01-architecture-fonctionnelle.md))
et le point le plus structurant de ce document. **Ces trois flux ne sont
jamais mélangés** — ni dans le code, ni dans `admin_stats_overview()`, ni
dans la comptabilité :

1. **Paiement de l'abonnement chauffeur → plateforme** : flux d'argent qui
   transite réellement par la plateforme, plateforme↔chauffeur. Doit être
   fiable, tracé, confirmé serveur — détail du cycle en
   [09-abonnement.md](09-abonnement.md).
2. **Paiement de la course → passager vers chauffeur, direct** : cash ou
   Mobile Money **du passager vers le chauffeur**, hors plateforme, sans
   que la plateforme ne touche les fonds. Le rôle de l'application ici est
   déclaratif : le chauffeur confirme avoir reçu le paiement en clôturant la
   course (`complete_ride(..., payment_confirmed)`), ce qui déclenche le
   calcul des frais de service et la facturation — aucune transaction
   financière ne passe par un compte plateforme pour ce flux au MVP.
3. **Frais de service chauffeur → plateforme (2,5 %/course)** : **nouveau**,
   ce n'est **pas** une commission prélevée sur le prix de la course — le
   passager paie toujours le prix affiché et rien de plus. C'est la
   rémunération du service technique (mise en relation, calcul du prix,
   facturation pour le compte du chauffeur), due par le chauffeur sur
   **chaque** course réglée avec succès. Comme la plateforme n'encaisse pas
   le prix de la course (flux 2), elle ne peut pas retenir ces 2,5 % au
   passage : la créance s'accumule course par course
   (`rides.platform_fee_fcfa`) et se règle par lot, périodiquement — voir
   §Frais de service et règlement ci-dessous.

Séparer les flux 2 et 3 du flux 1 évite à la plateforme d'avoir à obtenir
un agrément d'établissement de paiement/de monnaie électronique pour
manipuler les fonds des courses — seule la vente de son propre service
(l'abonnement, et la créance de frais de service qui n'est jamais un
encaissement pour compte de tiers) est un flux financier direct
plateforme↔chauffeur.

## Paiement de l'abonnement — architecture

```
App Chauffeur ─► purchase_subscription(plan_id, provider)
                          │
              payments(status='pending', provider_ref=null)
                          │
              Edge Function : initie la transaction chez le
              fournisseur Mobile Money (redirection USSD/app,
              ou lien de paiement selon l'intégration retenue)
                          │
        ┌─────────────────┴─────────────────┐
   Webhook fournisseur                 Polling de secours
   (paiement confirmé/échoué)          (si webhook non reçu après délai)
        │                                     │
        └─────────────────┬─────────────────┘
                           │
        Re-vérification directe auprès de l'API fournisseur
        (jamais confiance dans le seul contenu du webhook)
                           │
              payments.status = 'success' | 'failed'
                           │
              si succès → subscriptions activé/prolongé
```

**Implémenté et vérifié** : `purchase_subscription`/`confirm_subscription_payment`/
`admin_manual_payment_confirm` testés de bout en bout contre un Postgres
local (y compris avec code promo). L'Edge Function `payment-webhook-momo`
existe et vérifie déjà signature HMAC + déduplication + appel à
`confirm_subscription_payment` (`deno check`/`deno lint` propres contre les
vrais types) — seules la forme exacte du payload et la re-vérification
auprès de l'API du fournisseur restent à adapter une fois celui-ci choisi
(marqué `À ADAPTER` dans le code, isolé à deux fonctions).

Déduplication par `payment_webhook_events.event_key` (unique) — un webhook
livré deux fois (cas fréquent chez la plupart des fournisseurs Mobile Money)
ne doit jamais activer deux fois ou créer un doublon.

## Fournisseur(s) — décision ouverte

**Aucun fournisseur n'est câblé au jour 1**, par choix : MBONPLAN a
directement subi le coût d'un fournisseur qui a cessé de fonctionner au Togo
(CinetPay, retiré le 28/08/2026) après intégration complète. Ici,
l'abstraction (`payments.provider` en enum, logique isolée dans une seule
Edge Function `payment-webhook-momo`) permet de changer de fournisseur sans
toucher au reste du système.

Options à évaluer avec vous avant intégration réelle :

| Option | Nature | Remarque |
|---|---|---|
| **Flooz** (Moov Africa Togo) en direct | API opérateur | Couverture large, intégration technique à documenter |
| **TMoney** (Togocom) en direct | API opérateur | Idem, deuxième opérateur majeur au Togo |
| **Semoa Togo** (agrégateur) | Agrégateur multi-opérateurs | Déjà à l'étude côté MBONPLAN pour le même marché — mutualisation possible du choix |
| **CinetPay** | Agrégateur régional | Écarté côté MBONPLAN en 2026 (ne fonctionnait plus au Togo côté utilisateur) — à ne retenir qu'après vérification que le problème est résolu |

## Mode de secours — paiement manuel/admin

Exactement le principe déjà en place sur MBONPLAN pendant l'absence de
fournisseur actif : un chauffeur peut signaler avoir payé (référence de
transaction Mobile Money saisie manuellement, ex. reçu SMS de l'opérateur),
et un admin confirme manuellement via `admin_manual_payment_confirm` après
vérification. Ce mode permet de **lancer le MVP sans attendre le choix
définitif d'un fournisseur** — la bascule vers un flux automatisé n'impose
aucun changement de schéma, uniquement le branchement réel de l'Edge
Function.

## Frais de service et règlement (2,5 %/course)

**Nouveau, implémenté et vérifié** contre un Postgres local (course
complétée → 2,5 % calculés → créance accumulée → règlement par lot →
marquage payé, y compris le rejet d'un double règlement sur la même
période) :

```
complete_ride(ride_id, distance_km, duration_min, payment_confirmed)
                          │
        payment_confirmed = true (le chauffeur confirme avoir reçu
        le prix de la course, cash ou Mobile Money direct)
                          │
        rides.payment_status = 'success'
        rides.platform_fee_fcfa   = round(final_fare_fcfa × 2,5 %)
        rides.driver_amount_fcfa  = final_fare_fcfa − platform_fee_fcfa
                          │
        trigger generate_invoice_on_ride_success → invoices (facture)
                          │
        rides.settlement_id reste NULL — créance en attente
                          │
        (périodiquement, staff finance)
        admin_create_settlement(driver_id, period_start, period_end)
                          │
        regroupe toutes les courses payées non rattachées de la période
        → settlements(status='pending', platform_fees_fcfa=Σ)
        rides.settlement_id renseigné sur chacune (jamais reprises deux fois)
                          │
        admin_mark_settlement_paid(settlement_id, method)
                          │
        settlements.status = 'settled'
```

Si `payment_confirmed = false` (le chauffeur signale ne pas avoir reçu le
paiement) : `rides.payment_status = 'failed'`, aucun frais de service
crédité, aucune facture générée — la course reste `completed` mais le
litige se régularise via un ticket support, pas automatiquement.

**Pourquoi un règlement différé plutôt qu'un prélèvement immédiat** : la
plateforme ne touche pas le prix de la course (flux 2 ci-dessus), donc rien
ne lui permet de retenir sa part au moment du paiement. C'est un choix MVP
assumé, pas un oubli — à revoir une fois un fournisseur capable
d'encaisser pour le compte de la plateforme retenu (voir
[12-roadmap.md](12-roadmap.md)), ce qui permettrait un prélèvement course
par course plutôt que par lot.

## Facturation

Déclenchée automatiquement (trigger `generate_invoice_on_ride_success`,
voir [06-schema-base-donnees.md](06-schema-base-donnees.md)) dès qu'une
course passe à la fois par `completed` et `payment_status = 'success'` —
jamais générée à la main, jamais générée deux fois pour la même course
(`invoices.ride_id` unique). Porte tout ce qui identifie la course
(numéro de facture, date, chauffeur, passager, véhicule/plaque, trajet,
distance, tarif appliqué), le montant transport (`transport_amount_fcfa`
= part chauffeur), le montant des frais de service
(`platform_fee_fcfa`), le total (`total_fcfa` = ce que le passager a
réellement payé — jamais un montant supplémentaire), le mode de paiement
et sa référence si disponible.

Le chauffeur est le prestataire du transport, la plateforme émet le
document **pour son compte** (voir
[01-architecture-fonctionnelle.md](01-architecture-fonctionnelle.md)
§Rôle des parties) — jamais présentée comme la partie qui transporte.
Accessible par le passager, le chauffeur concerné et le staff
`finance`/`admin`/`super_admin` (RLS, migration 1).

**Ne fait pas encore au MVP** : le rendu PDF du document lui-même (seule
la ligne de données `invoices` est produite pour l'instant, voir
[12-roadmap.md](12-roadmap.md)) ; la compatibilité fine avec le régime
fiscal togolais applicable à ce mécanisme de facturation pour compte de
tiers reste à valider avec vous avant mise en production réelle.

## Historique et reçus

- `payments` conserve l'intégralité des tentatives (y compris échouées) —
  jamais de suppression.
- Un reçu simple est généré (PDF, `jsPDF`) pour chaque abonnement payé avec
  succès, consultable dans `/abonnement` côté chauffeur — distinct de la
  facture de course (`invoices`) ci-dessus, jamais confondu dans les deux
  revenus.
- Remboursement : au MVP, uniquement manuel côté admin
  (`payments.status='refunded'` + note), pas de remboursement automatisé —
  cas rare pour un abonnement de 24 h à 500-1 000 FCFA, traité au cas par
  cas.

## Sécurité du circuit de paiement

- Clés API fournisseur **jamais côté client** — uniquement dans les
  variables d'environnement serveur des Edge Functions (cf. règle MBONPLAN :
  secrets jamais commités, jamais dans le bundle mobile).
- Signature de chaque webhook vérifiée avant tout traitement.
- Montant et référence toujours revérifiés auprès de l'API fournisseur avant
  activation — un webhook ne suffit jamais seul.
