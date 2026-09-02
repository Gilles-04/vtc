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
2. `drivers.is_available = true`
3. Un abonnement `driver_subscriptions` avec `status='active'` **et**
   `expires_at > now()` — vérifié à l'instant du matching, pas mis en cache
4. `drivers.last_location_at` récent (position fraîche — au-delà d'un seuil,
   ex. 2 minutes, le chauffeur est considéré injoignable même s'il se dit
   disponible)
5. Aucune course déjà `accepted`/`in_progress` en cours pour ce chauffeur
   (un chauffeur ne reçoit jamais deux courses actives simultanément)
6. Dans un rayon de recherche autour du point de prise en charge (rayon
   initial ex. 3 km, extensible par paliers si aucun candidat — voir
   étape 3)

Ce filtrage est une requête PostGIS (`ST_DWithin` sur `current_location`),
pas un calcul applicatif — indispensable pour rester performant à l'échelle
(voir [02-architecture-technique.md](02-architecture-technique.md)).

## Étape 1 — Classement des candidats

Score composite, dans cet ordre de priorité (le premier critère départage la
majorité des cas ; les suivants ne servent qu'à trancher les ex-æquo) :

1. **Distance** au point de prise en charge (croissant) — critère dominant :
   un passager togolais attend un chauffeur proche, pas un chauffeur mieux
   noté mais loin.
2. **Note moyenne** (`rating_avg`, décroissant) — départage à distance
   comparable (même tranche, ex. ±300 m).
3. **Fiabilité** — taux d'acceptation récent et taux d'annulation après
   acceptation (décroissant) : un chauffeur qui accepte puis annule
   fréquemment descend dans le classement, sans être exclu.
4. **Ancienneté de disponibilité** (chauffeur disponible depuis le plus
   longtemps en dernier recours, pour une répartition plus équitable des
   courses entre chauffeurs abonnés).

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
    ride.status = 'no_drivers_found'
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
déclarer `no_drivers_found`. Chaque palier relance l'étape 1 complète.

## Concurrence et atomicité

- La transition `ride_offers.status: pending → accepted` se fait par un
  `UPDATE ... WHERE id = $1 AND status = 'pending'` — si deux tentatives
  arrivent en même temps (ne devrait pas arriver avec le dispatch séquentiel,
  mais reste une garantie), une seule réussit.
- L'expiration est gérée par la Edge Function `ride-offer-timeout`
  (`pg_cron`, cadence courte) plutôt que par un minuteur côté client, pour
  ne jamais dépendre de la connectivité du téléphone du chauffeur.
- Toute annulation du passager pendant la recherche (avant acceptation)
  expire immédiatement l'offre `pending` en cours et arrête le dispatch.

## Ce qui n'est pas dans le MVP

Tarification dynamique liée à la demande (surge pricing), pré-réservation à
l'avance, choix manuel du chauffeur par le passager, dispatch par lots
parallèles — tous documentés comme extensions possibles en
[12-roadmap.md](12-roadmap.md), le schéma de données (`ride_offers.rank`
notamment) n'interdit aucune de ces évolutions.
