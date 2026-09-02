// Envoie une notification push (Expo) à chaque nouvelle ligne insérée
// dans `notifications` — déclenchée par un Database Webhook Supabase
// (Database → Webhooks → INSERT sur `public.notifications`), jamais
// appelée directement par un client mobile.
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";

interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
}

interface DatabaseWebhookPayload {
  type: string;
  table: string;
  record: NotificationRecord;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const payload = (await req.json().catch(() => null)) as DatabaseWebhookPayload | null;
  if (!payload || payload.type !== "INSERT" || payload.table !== "notifications") {
    return jsonResponse({ error: "unexpected_payload" }, 400);
  }

  const notification = payload.record;
  const supabase = createAdminClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("push_token")
    .eq("id", notification.user_id)
    .maybeSingle();

  if (error) {
    console.error("push-notifications-dispatch: lecture du profil échouée", error);
    return jsonResponse({ error: "lookup_failed" }, 500);
  }
  if (!profile?.push_token) {
    return jsonResponse({ ok: true, skipped: "no_push_token" });
  }

  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      to: profile.push_token,
      title: notification.title,
      body: notification.body,
      data: { type: notification.type, ...(notification.data ?? {}) },
    }),
  });

  if (!res.ok) {
    console.error("push-notifications-dispatch: Expo a répondu", res.status, await res.text());
    return jsonResponse({ error: "push_failed" }, 502);
  }

  return jsonResponse({ ok: true });
});
