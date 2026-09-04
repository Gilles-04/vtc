# matching-worker

Processus Node.js **toujours actif** qui relance le matching pour les
courses dont l'offre en cours vient d'expirer — voir
[`../../docs/08-matching.md`](../../docs/08-matching.md).

**Vérifié réellement** (pas seulement compilé) : testé contre un Postgres
local avec le schéma du projet appliqué — une offre expirée artificiellement
a bien été balayée au premier cycle, avec relance correcte du dispatch.

**État réel (4 septembre 2026) : jamais déployé.** Aucun VPS choisi pour
ce projet à ce jour (le VPS existant sert un autre projet du porteur du
projet — une décision de déploiement qui n'est pas à ce process de
prendre seul). Conséquence : sans ce worker (ni son repli temporaire
ci-dessous), une course dont le chauffeur ne répond jamais restait
bloquée indéfiniment en `'searching'`. Comblé en attendant par un repli
`pg_cron` toutes les 5 secondes (migration
`00000000000017_interim_cron_offer_sweep.sql`, confirmé avec le porteur
du projet avant activation) — voir §Pourquoi un processus à part
ci-dessous, qui affirmait à tort que `pg_cron` ne pouvait pas descendre
sous la minute.

## Pourquoi un processus à part, pas une tâche planifiée Supabase ?

**Le paragraphe suivant contenait une erreur, corrigée le 4 septembre
2026** : `pg_cron` accepte en réalité un intervalle en secondes
(`cron.schedule(name, '5 seconds', ...)`), vérifié directement contre le
projet réel — quatre exécutions consécutives espacées exactement de 10 s
dans `cron.job_run_details` lors du test. Le raisonnement ci-dessous sur
la granularité minute reste correct pour la syntaxe cron classique à 5
champs (`* * * * *`), pas pour cette syntaxe alternative en intervalle.

Le délai d'une offre est de 15 secondes — un passager attendrait trop
longtemps avant qu'on essaie le chauffeur suivant si le balayage était
trop lent. Un processus Node.js dédié reste la solution prévue à terme
(boucle applicative simple, gestion d'erreurs/redémarrage `systemd` plus
robuste qu'une tâche `pg_cron`, aucune dépendance à la disponibilité du
scheduler Supabase) : il interroge la base toutes les ~5 secondes et
appelle `select public.expire_ride_offers_and_dispatch();` — une fonction
SQL qui expire les offres dépassées et relance elle-même le dispatch vers
le chauffeur suivant (voir [`../../docs/07-api.md`](../../docs/07-api.md)).
En attendant son déploiement, le repli `pg_cron` ci-dessus appelle
exactement la même fonction à la même cadence.

Un seul processus suffit largement jusqu'à plusieurs dizaines de milliers de
chauffeurs : la requête est légère et indexée sur `expires_at` — pas besoin
d'y revenir avant longtemps.

## Démarrage

```sh
npm ci
npm run build
cp .env.example .env    # puis renseigner SUPABASE_DB_URL
npm start
```

## Déploiement en production

Cohérent avec le VPS déjà utilisé pour MBONPLAN : `systemd`.

```sh
sudo mkdir -p /srv/vtc/services/matching-worker
# copier le contenu du dossier + npm ci --omit=dev + npm run build sur le serveur
sudo cp systemd/matching-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now matching-worker
sudo journalctl -u matching-worker -f
```

Le worker s'arrête proprement (`SIGTERM`/`SIGINT`) et se relance seul en cas
d'échec (`Restart=on-failure`) — dix échecs de connexion consécutifs
provoquent un arrêt volontaire du processus, `systemd` le relance ensuite
selon `RestartSec`.

**Une fois ce worker déployé** : le repli `pg_cron` (tâche
`sweep-expired-ride-offers`) peut rester actif sans risque en parallèle
(`expire_ride_offers_and_dispatch()` utilise `for update skip locked` —
deux appelants concurrents ne se marchent jamais dessus, juste un peu de
travail redondant) — le désactiver n'est qu'une question de propreté,
pas de sécurité : `select cron.unschedule('sweep-expired-ride-offers');`.

## Ce qui n'est PAS géré ici

- La confirmation des paiements Mobile Money : Edge Function
  `payment-webhook-momo` (appelée par le fournisseur, pas par ce worker).
- L'expiration des abonnements : `pg_cron`, une fois par minute suffit
  largement.
