# matching-worker

Processus Node.js **toujours actif** qui relance le matching pour les
courses dont l'offre en cours vient d'expirer — voir
[`../../docs/08-matching.md`](../../docs/08-matching.md).

**Vérifié réellement** (pas seulement compilé) : testé contre un Postgres
local avec le schéma du projet appliqué — une offre expirée artificiellement
a bien été balayée au premier cycle, avec relance correcte du dispatch.

## Pourquoi un processus à part, pas une tâche planifiée Supabase ?

Le délai d'une offre est de 15 secondes. `pg_cron` (utilisé pour
l'expiration des abonnements — tâche à la minute, voir la migration
`00000000000002_business_logic.sql`) ne descend pas sous la minute, et les
Edge Functions planifiées de Supabase ont la même limite : un passager
attendrait jusqu'à une minute avant qu'on essaie le chauffeur suivant,
inacceptable. Il faut donc un petit processus séparé, toujours en cours
d'exécution, qui interroge la base toutes les ~5 secondes et appelle
`select public.expire_ride_offers_and_dispatch();` — une fonction SQL qui
expire les offres dépassées et relance elle-même le dispatch vers le
chauffeur suivant (voir [`../../docs/07-api.md`](../../docs/07-api.md)).

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

## Ce qui n'est PAS géré ici

- La confirmation des paiements Mobile Money : Edge Function
  `payment-webhook-momo` (appelée par le fournisseur, pas par ce worker).
- L'expiration des abonnements : `pg_cron`, une fois par minute suffit
  largement.
