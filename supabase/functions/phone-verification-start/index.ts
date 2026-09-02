// Démarre la vérification d'un numéro togolais via eSMS Verify (OTP) —
// même fournisseur, même API que MBONPLAN (compte/API key distincts,
// voir docs/02-architecture-technique.md), adapté ici à un flux
// *avant* création de compte : le numéro est suivi dans
// `phone_verifications`, pas encore associé à un `auth.users`.
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse, handleCorsPreflight } from "../_shared/cors.ts";

const VERIFY_START_URL = "https://sms.esmsafrica.io/api/verify/start";

interface VerifyStartResponse {
  verification_id: string;
  expires_at: string;
}

// Togo : indicatif +228, 8 chiffres locaux. Reprend la leçon MBONPLAN
// (`toE164()`) : rejeter tout de suite un indicatif retapé en double
// plutôt que de laisser eSMS le refuser sans explication utile.
function normalizePhone(raw: unknown): string | null {
  const digits = String(raw ?? "").trim().replace(/[^\d+]/g, "");
  return /^\+228\d{8}$/.test(digits) ? digits : null;
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, reason: "method_not_allowed" }, 405);
  }

  const apiKey = Deno.env.get("ESMS_AFRICA_API_KEY");
  const appId = Deno.env.get("ESMS_AFRICA_VERIFY_APP_ID");
  if (!apiKey || !appId) {
    return jsonResponse({ ok: false, reason: "not_configured" });
  }

  const body = await req.json().catch(() => null);
  const phone = normalizePhone(body?.phone);
  if (!phone) {
    return jsonResponse({ ok: false, reason: "invalid_phone" }, 400);
  }

  const supabase = createAdminClient();

  // Limite de débit + purge implicite des demandes en cours AVANT de
  // payer un appel eSMS (docs/11-securite.md).
  const { error: allowError } = await supabase.rpc("request_phone_verification", { _phone: phone });
  if (allowError) {
    return jsonResponse({ ok: false, reason: "rate_limited" }, 429);
  }

  let res: Response;
  try {
    res = await fetch(VERIFY_START_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ to: phone, app_id: appId }),
    });
  } catch (err) {
    console.error("phone-verification-start: appel eSMS échoué", err);
    return jsonResponse({ ok: false, reason: "send_failed" }, 502);
  }

  if (!res.ok) {
    console.error("phone-verification-start: eSMS a répondu", res.status, await res.text());
    return jsonResponse({ ok: false, reason: "send_failed" }, 502);
  }

  const payload = (await res.json()) as VerifyStartResponse;

  const { error: recordError } = await supabase.rpc("record_phone_verification", {
    _phone: phone,
    _verification_id: payload.verification_id,
    _expires_at: payload.expires_at,
  });
  if (recordError) {
    console.error("phone-verification-start: record_phone_verification échoué", recordError);
    return jsonResponse({ ok: false, reason: "send_failed" }, 500);
  }

  return jsonResponse({ ok: true });
});
