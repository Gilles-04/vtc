import { Pool } from "pg";

const DATABASE_URL = process.env.SUPABASE_DB_URL;
const POLL_INTERVAL_MS = Number(process.env.MATCHING_WORKER_INTERVAL_MS ?? 5000);
const MAX_CONSECUTIVE_FAILURES = 10;

if (!DATABASE_URL) {
  console.error("[matching-worker] SUPABASE_DB_URL manquant — voir .env.example");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 30_000,
});

let stopping = false;
let consecutiveFailures = 0;

interface SweepRow {
  expire_ride_offers_and_dispatch: number;
}

async function sweepOnce(): Promise<number> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<SweepRow>("select public.expire_ride_offers_and_dispatch()");
    return rows[0]?.expire_ride_offers_and_dispatch ?? 0;
  } finally {
    client.release();
  }
}

async function loop(): Promise<void> {
  while (!stopping) {
    const startedAt = Date.now();
    try {
      const processed = await sweepOnce();
      if (processed > 0) {
        console.log(`[matching-worker] ${new Date().toISOString()} offres relancées : ${processed}`);
      }
      consecutiveFailures = 0;
    } catch (err) {
      consecutiveFailures += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[matching-worker] échec du balayage (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}) : ${message}`);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error("[matching-worker] trop d'échecs consécutifs, arrêt du processus (le service manager le redémarrera).");
        process.exit(1);
      }
    }

    const elapsed = Date.now() - startedAt;
    const wait = Math.max(POLL_INTERVAL_MS - elapsed, 250);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

function shutdown(signal: string): void {
  console.log(`[matching-worker] signal ${signal} reçu, arrêt propre...`);
  stopping = true;
  pool
    .end()
    .catch(() => undefined)
    .finally(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log(`[matching-worker] démarré — intervalle ${POLL_INTERVAL_MS}ms`);
void loop();
