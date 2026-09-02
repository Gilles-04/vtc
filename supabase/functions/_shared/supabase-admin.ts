// Client Supabase avec la clé de service — contourne RLS, réservé aux
// Edge Functions elles-mêmes. Ne jamais réexporter ni exposer cette
// instance côté client.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants — configurés automatiquement par Supabase en production.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
