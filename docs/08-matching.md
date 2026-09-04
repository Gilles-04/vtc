# 08 — Logique du matching

## Objectif

Attribuer une course au chauffeur le plus pertinent parmi ceux **réellement
en mesure de la prendre**, sans jamais bloquer le passager en attente
indéfinie, et sans jamais envoyer une course à un chauffeur qui n'a pas le
droit d'en recevoir.

## Étape 0 — Filtrage strict (condition d'entrée, pas de classement)

Un chauffeur n'entre dans le pool candidat que s'il remplit **toutes** ces
conditions simultanément :

1. `drivers.status = 'approved'`
2. `drivers.category = rides.category` — **filtrage absolu, pas un critère
   de classement** : un passager qui commande une voiture ne voit jamais un
   candidat moto, et inversement (voir
   [01-architecture-fonctionnelle.md](01-architecture-fonctionnelle.md)
   §Deux catégories). Vérifié réellement : dans un scénario avec un
   chauffeur voiture et un chauffeur moto tous deux disponibles à la même
   position, une course « voiture » n'a jamais produit d'offre vers le
   chauffeur moto.
3. `drivers.is_available = true`
4. Un abonnement `subscriptions` avec `status='active'` **et**
   `expires_at > now()` — vérifié à l'instant du matching, pas mis en cache
   (l'abonnement acheté est déjà celui de la bonne catégorie, imposé à
   l'achat par `purchase_subscription`, voir [09-abonnement.md](09-abonnement.md))
5. `drivers.last_location_at` récent (position fraîche — au-delà d'un seuil,
   ex. 2 minutes, le chauffeur est considéré injoignable même s'il se dit
   disponible)
6. Aucune course déjà `accepted`/`in_progress` en cours pour ce chauffeur
   (un chauffeur ne reçoit jamais deux courses actives simultanément)
7. Dans un rayon de recherche autour du point de prise en charge (rayon
   initial ex. 3 km, extensible par paliers si aucun candidat — voir
   étape 3)

Ce filtrage est une requête PostGIS (`ST_DWithin` sur `current_location`),
pas un calcul applicatif — indispensable pour rester performant à l'échelle
(voir [02-architecture-technique.md](02-architecture-technique.md)).

## Étape 1 — Classement des candidats

Score composite, **implémenté et testé** tel quel dans `dispatch_next_offer`
(migration `00000000000002_business_logic.sql`, critères de fiabilité
ajoutés en migration `00000000000016_driver_reliability_score.sql`),
dans cet ordre de priorité (le premier critère départage la majorité des
cas ; les suivants ne servent qu'à trancher les ex-æquo) :

1. **Distance** au point de prise en charge (croissant, `ST_Distance`) —
   critère dominant : un passager togolais attend un chauffeur proche, pas
   un chauffeur mieux noté mais loin.
2. **Taux d'annulation après acceptation** (`cancellation_rate`,
   croissant — le moins de casse d'abord) — départage à distance
   comparable, avant la note : un chauffeur qui accepte puis annule fait
   perdre plus de temps au passager qu'un chauffeur moins bien noté mais
   fiable.
3. **Taux d'acceptation récent** (`acceptance_rate`, décroissant).
4. **Note moyenne** (`rating_avg`, décroissant).
5. **Ancienneté de disponibilité** (`last_location_at` le plus ancien en
   dernier recours, pour une répartition plus équitable des courses entre
   chauffeurs abonnés).

**Fiabilité (2 et 3)** : `drivers.acceptance_rate`/`cancellation_rate`
(`numeric(5,2)`, pourcentage), recalculées toutes les 15 minutes par
`recompute_driver_reliability()` (`pg_cron`, jamais en temps réel sur le
chemin chaud du dispatch) sur une fenêtre glissante de 30 jours —
`acceptance_rate` = part des offres résolues (`accepted`/`rejected`/
`expired`, jamais `pending`) acceptées ; `cancellation_rate` = part des
courses effectivement acceptées (`rides.driver_id` renseigné) que le
chauffeur a lui-même annulées ensuite (`cancelled_by = 'driver'` — une
annulation par le passager après acceptation du chauffeur ne compte
jamais contre lui). `null` (jamais `0`) sans donnée récente — un
chauffeur sans historique récent n'est pas classé comme le pire candidat
possible par manque de données, `dispatch_next_offer` traite `null`
comme neutre/favorable (`coalesce(cancellation_rate, 0)`,
`coalesce(acceptance_rate, 100)`). Vérifié réellement : deux chauffeurs à
distance identique, l'un fiable (100 %/0 %) et l'autre non (25 %/100 %) —
le fiable systématiquement choisi ; un chauffeur sans historique récent
départagé équitablement contre un chauffeur fiable par la note, jamais
pénalisé par l'absence de données.

## Étape 2 — Dispatch séquentiel

```
candidats classés = [C1, C2, C3, ...]
rang = 1
pour chaque candidat Ci dans l'ordre :
    créer ride_offers(ride_id, driver_id=Ci, rang, status='pending',
                        expires_at = now() + délai_réponse)
    notifier Ci en Realtime + push
    attendre : réponse OU expiration (dont la valeur la plus proche)
    si accepté :
        ride.status = 'accepted', ride.driver_id = Ci
        toutes les autres offres pending de cette course → 'expired'
        FIN — course attribuée
    sinon (refusé ou expiré) :
        offre → 'rejected' ou 'expired'
        rang += 1, passer au candidat suivant
si tous les candidats épuisés :
    ride.status = 'cancelled_by_system', cancelled_by = 'system',
                  cancellation_reason = 'no_drivers_available'
    notifier le passager (proposer de réessayer)
```

Délai de réponse par offre : **15 secondes** (assez court pour ne pas faire
attendre le passager, assez long pour qu'un chauffeur en conduite puisse
répondre en sécurité). Une seule offre `pending` à la fois par course — pas
d'envoi groupé à plusieurs chauffeurs simultanément au MVP (plus simple à
raisonner, évite qu'un chauffeur accepte une course déjà prise par un autre ;
un envoi groupé avec verrouillage optimiste est une évolution possible, voir
[12-roadmap.md](12-roadmap.md), si le délai d'attribution devient un problème
mesuré en usage réel).

## Étape 3 — Élargissement progressif si aucun candidat

Si l'étape 0 ne retourne aucun candidat dans le rayon initial : élargir le
rayon par paliers (3 km → 5 km → 8 km, deux relances maximum) avant de
passer la course à `cancelled_by_system`. Chaque palier relance l'étape 1
complète.

## Concurrence et atomicité

- La transition `ride_offers.status: pending → accepted` se fait par un
  `UPDATE ... WHERE id = $1 AND status = 'pending'` — si deux tentatives
  arrivent en même temps (ne devrait pas arriver avec le dispatch séquentiel,
  mais reste une garantie), une seule réussit.
- L'expiration est gérée par `expire_ride_offers_and_dispatch()`, prévue
  pour être appelée toutes les ~5 secondes par un petit processus à part
  toujours actif (`services/matching-worker/`) — jamais par un minuteur
  côté client, pour ne jamais dépendre de la connectivité du téléphone du
  chauffeur. **Ce worker n'a jamais été déployé** (aucun VPS choisi pour
  ce projet à ce jour) — en attendant, `expire_ride_offers_and_dispatch()`
  est planifiée via `pg_cron` toutes les 5 secondes (migration
  `00000000000017_interim_cron_offer_sweep.sql`). Correction d'une
  affirmation fausse de ce document et du README du worker : `pg_cron`
  avait été écarté en pensant sa granularité limitée à la minute — vérifié
  directement contre le projet réel que c'est faux, un intervalle en
  secondes est accepté et exécuté à la cadence exacte demandée (confirmé
  par plusieurs exécutions consécutives dans `cron.job_run_details`,
  espacées de 5 s pile). Solution de repli, pas un remplacement définitif
  — le worker dédié reste la solution prévue une fois un serveur choisi
  (gestion d'erreurs/redémarrage plus robuste, voir son README).
- Toute annulation du passager pendant la recherche (avant acceptation)
  expire immédiatement l'offre `pending` en cours et arrête le dispatch.

## Ce qui n'est pas dans le MVP

Tarification dynamique liée à la demande (surge pricing), pré-réservation à
l'avance, choix manuel du chauffeur par le passager, dispatch par lots
parallèles — tous documentés comme extensions possibles en
[12-roadmap.md](12-roadmap.md), le schéma de données (`ride_offers.rank`
notamment) n'interdit aucune de ces évolutions.
