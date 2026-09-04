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
2. **Paiement de la course → passager vers chauffeur** : cash ou Mobile
   Money. **Révisé le 3 septembre 2026** — les deux modes ne suivent plus
   le même chemin technique :
   - **Cash** : purement déclaratif. Le chauffeur confirme avoir reçu le
     paiement en clôturant la course (`complete_ride(..., payment_confirmed)`),
     ce qui déclenche immédiatement le calcul des frais de service et la
     facturation. Aucune transaction ne transite par un fournisseur.
   - **Mobile Money** : suit désormais le même mécanisme de webhook
     vérifié que l'abonnement (créer une transaction, attendre la
     confirmation fournisseur, vérifier avant d'activer — voir §Paiement
     de la course ci-dessous) plutôt qu'une simple confirmation déclarée.
     **Nuance importante, non tranchée** : que les fonds transitent
     réellement par un compte plateforme (API de collecte pour compte de
     tiers) ou soient un virement direct passager→chauffeur dont la
     plateforme n'est que spectatrice via une notification du fournisseur
     dépend du fournisseur retenu (§Fournisseur(s) ci-dessous) — une
     question de statut réglementaire à trancher avec vous avant
     production réelle, pas supposée résolue ici.
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

## Paiement de la course — architecture

**Nouveau (3 septembre 2026), implémenté et vérifié** contre un Postgres
local — cash et Mobile Money divergent dès `complete_ride` :

```
complete_ride(ride_id, distance_km, duration_min, payment_confirmed?, provider?)
                          │
              ┌───────────┴───────────┐
         payment_method            payment_method
           = 'cash'                = 'mobile_money'
              │                          │
   payment_confirmed (bouton      1. créer transaction ─► payments(purpose=
   chauffeur, même geste que        'ride_fare', ride_id, status='pending')
   "Terminer la course")          2. transmettre au fournisseur (Edge Function)
              │                   3. attendre webhook fournisseur
   rides.payment_status =            │
   'success' | 'failed'          4. vérifier signature (payment-webhook-momo,
   immédiat, frais de service       HMAC, déjà en place)
   calculés tout de suite         5. vérifier montant (re-vérification API
              │                      fournisseur — À ADAPTER — puis comparé à
              │                      payments.amount_fcfa dans confirm_ride_payment)
              │                   6. vérifier ride_id (payments.ride_id comparé
              │                      à la valeur attendue, confirm_ride_payment)
              │                   7. vérifier transaction_id + 8. empêcher les
              │                      doublons (contrainte unique (provider,
              │                      provider_ref) — refuse la réutilisation
              │                      d'un transaction_id au niveau base,
              │                      pas seulement applicatif)
              │                   9. confirm_ride_payment → payments.status=
              │                      'success', rides.payment_status='success',
              │                      platform_fee_fcfa/driver_amount_fcfa calculés
              └──────────┬───────────┘
                         │
         10. trigger generate_invoice_on_ride_success → facture générée
```

**Vérifié réellement** (pas seulement relu) : une course Mobile Money
laisse `rides.payment_status='processing'` et `platform_fee_fcfa`/
`driver_amount_fcfa` nuls tant que `confirm_ride_payment` n'a pas confirmé
— aucune facture n'existe avant ce point. `confirm_ride_payment` rejette
un montant confirmé différent de celui attendu (`amount_mismatch`) et un
`ride_id` différent de celui du paiement (`ride_id_mismatch`) ; réutiliser
un `provider_ref` déjà consommé par un autre paiement (abonnement ou
course, même table) est rejeté par la contrainte unique
`payments_provider_ref_unique_idx`, confirmé en tentant l'insertion. Un
webhook fournisseur signalant un échec fait passer `rides.payment_status`
à `'failed'` (jamais laissé en `'processing'` indéfiniment) — même
comportement testé via `admin_mark_payment_failed`, utilisable en mode
manuel tant qu'aucun fournisseur réel n'est branché.

`payment-webhook-momo` route désormais vers `confirm_ride_payment` ou
`confirm_subscription_payment` selon `payments.purpose` — même Edge
Function, même déduplication `payment_webhook_events`, deux fonctions de
confirmation aux effets différents (voir §Paiement de l'abonnement
ci-dessus).

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

**Implémenté et vérifié** contre un Postgres local (course complétée → 2,5 %
calculés → créance accumulée → règlement par lot → marquage payé, y compris
le rejet d'un double règlement sur la même période). Point d'entrée commun
aux deux modes de paiement — cash (immédiat) ou Mobile Money (après
`confirm_ride_payment`, voir §Paiement de la course) :

```
rides.payment_status passe à 'success'
(cash : dans complete_ride ; mobile money : dans confirm_ride_payment)
                          │
        platform_fee_fcfa   = round(final_fare_fcfa × 2,5 %)
        driver_amount_fcfa  = final_fare_fcfa − platform_fee_fcfa
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

Si le paiement échoue (cash : `payment_confirmed = false` ; Mobile Money :
webhook fournisseur négatif ou `admin_mark_payment_failed`) :
`rides.payment_status = 'failed'`, aucun frais de service crédité, aucune
facture générée — la course reste `completed` mais le litige se
régularise via un ticket support, pas automatiquement.

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
- Un reçu simple (PDF, `jsPDF`, généré et téléchargé côté client — aucun
  stockage du fichier lui-même) est disponible pour chaque paiement
  d'abonnement réussi, dans la section « Reçus » du tableau de bord
  chauffeur (`apps/web`, pas encore porté sur `apps/mobile`) — distinct de
  la facture de course (`invoices`) ci-dessus, jamais confondu dans les
  deux revenus.
- Remboursement : au MVP, uniquement manuel côté admin/finance
  (`admin_refund_payment(payment_id, reason)`, vérifié réellement — un
  paiement déjà `success` seulement, jamais deux fois de suite sur le
  même), pas de remboursement automatisé auprès du fournisseur. S'applique
  aux deux flux (abonnement et course) ; pour une course, `rides.payment_status`
  repasse à `'refunded'` en même temps — confirmé : les agrégats de
  `admin_stats_overview()` filtrés sur `payment_status='success'` (frais de
  service, volume, gains chauffeur) excluent alors automatiquement cette
  course, sans double comptage.

## Sécurité du circuit de paiement

- Clés API fournisseur **jamais côté client** — uniquement dans les
  variables d'environnement serveur des Edge Functions (cf. règle MBONPLAN :
  secrets jamais commités, jamais dans le bundle mobile).
- Signature de chaque webhook vérifiée avant tout traitement (`payment-webhook-momo`).
- Montant et référence toujours revérifiés auprès de l'API fournisseur avant
  activation — un webhook ne suffit jamais seul ; pour une course,
  `confirm_ride_payment` re-vérifie en plus explicitement le montant
  attendu et le `ride_id`, et rejette l'un ou l'autre s'ils ne
  correspondent pas (`amount_mismatch`/`ride_id_mismatch`, vérifié
  réellement).
- Réutilisation d'un `transaction_id` (`provider_ref`) entre deux paiements
  distincts **impossible au niveau base** (`payments_provider_ref_unique_idx`,
  contrainte unique `(provider, provider_ref)`), pas seulement une
  vérification applicative contournable — confirmé par un test d'insertion
  qui échoue comme attendu.
