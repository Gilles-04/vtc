-- `services/matching-worker/` (processus Node.js dédié, `expires_at`
-- balayé toutes les ~5 s) n'a jamais été déployé — aucun VPS choisi pour
-- ce projet à ce jour (le VPS existant sert un autre projet du porteur du
-- projet, une décision de déploiement qui n'est pas la mienne à prendre).
-- Conséquence réelle, découverte en vérifiant l'état de `pg_cron` pour la
-- migration 16 : une course dont le chauffeur assigné ne répond jamais à
-- l'offre (téléphone éteint, app fermée...) reste bloquée indéfiniment en
-- 'searching' — rien ne relance jamais le dispatch vers le candidat
-- suivant. Un vrai trou de production, pas seulement un manque de finition.
--
-- `services/matching-worker/README.md` documentait `pg_cron` comme écarté
-- pour ce rôle (« sa granularité minimale est la minute ») — vérifié
-- directement contre le projet réel que c'est faux : `cron.schedule`
-- accepte un intervalle en secondes (testé en direct : job réel toutes
-- les 10 s, confirmé par 4 exécutions espacées exactement de 10 s dans
-- `cron.job_run_details`). Confirmé avec le porteur du projet avant
-- d'agir (AskUserQuestion) : solution de repli le temps qu'un serveur
-- soit choisi pour le worker dédié — celui-ci reste la solution prévue
-- (vraie boucle applicative, gestion d'erreurs/redémarrage `systemd`,
-- voir son README), pas remplacé, seulement complété en attendant.
--
-- `expire_ride_offers_and_dispatch()` (migration 2) est déjà idempotente
-- et sûre à appeler en concurrence (`for update skip locked`) — c'est
-- exactement ce que fait déjà `services/matching-worker/src/index.ts` en
-- boucle ; aucune fonction/grant nouveau nécessaire ici, seulement la
-- planification.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('sweep-expired-ride-offers', '5 seconds', $cron$select public.expire_ride_offers_and_dispatch();$cron$);
  end if;
end;
$$;
