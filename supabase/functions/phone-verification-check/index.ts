// Vérifie le code saisi auprès d'eSMS Verify puis ouvre une session
// Supabase pour le numéro confirmé — création du compte s'il n'existe pas
// encore, réutilisation sinon.
//
// Point le plus délicat du projet (À VÉRIFIER en priorité contre un vrai
// projet Supabase, Phase 1 de docs/12-roadmap.md, avant tout lancement
// réel) : Supabase n'expose pas d'équivalent "generateLink" pour le
// téléphone (seulement pour l'e-mail). Le mécanisme utilisé ici — mot de
// passe aléatoire à usage unique, généré et jeté dans le même appel,
// jamais transmis ni stocké — est le contournement standard documenté par
// la communauté Supabase pour ce cas précis (fournisseur OTP maison) ; il
// ne s'appuie que sur des méthodes publiques et stables de l'API Admin
// (`createUser`/`updateUserById` + `signInWithPassword`), jamais sur un
// détail d'implémentation non garanti.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse, handleCorsPreflight } from "../_shared/cors.ts";

const VERIFY_CHECK_URL = "https://sms.esmsafrica.io/api/verify/check";

interface VerifyCheckResponse {
  status: string;
  verification_id: string;
  attempts_remaining?: number;
}

// Supabase stocke `auth.users.phone` sans le `+` initial (E.164 sans
// préfixe) — convention à revérifier contre un vrai projet avant mise en
// production (voir l'avertissement en tête de fichier).
function toSupabasePhone(e164: string): string {
  return e164.replace(/^\+/, "");
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, reason: "method_not_allowed" }, 405);
  }

  const apiKey = Deno.env.get("ESMS_AFRICA_API_KEY");
  if (!apiKey) {
    return jsonResponse({ ok: false, reason: "not_configured" });
  }

  const body = await req.json().catch(() => null);
  const phone = String(body?.phone ?? "").trim();
  const code = String(body?.code ?? "").trim();
  if (!phone.startsWith("+228") || !code) {
    return jsonResponse({ ok: false, reason: "invalid_input" }, 400);
  }

  const supabase = createAdminClient();

  const { data: pending, error: pendingError } = await supabase
    .from("phone_verifications")
    .select("verification_id")
    .eq("phone", phone)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingError || !pending?.verification_id) {
    return jsonResponse({ ok: false, reason: "no_pending" }, 404);
  }

  let res: Response;
  try {
    res = await fetch(VERIFY_CHECK_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ verification_id: pending.verification_id, code }),
    });
  } catch (err) {
    console.error("phone-verification-check: appel eSMS échoué", err);
    return jsonResponse({ ok: false, reason: "check_failed" }, 502);
  }

  const payload = (await res.json().catch(() => null)) as VerifyCheckResponse | null;
  if (!res.ok || !payload) {
    console.error("phone-verification-check: eSMS a répondu", res.status, payload);
    return jsonResponse({ ok: false, reason: "check_failed" }, 502);
  }
  if (payload.status !== "verified") {
    return jsonResponse({ ok: false, reason: "wrong_code", attemptsRemaining: payload.attempts_remaining ?? null });
  }

  const { data: finalized, error: finalizeError } = await supabase.rpc("finalize_phone_verification", {
    _phone: phone,
    _verification_id: pending.verification_id,
  });
  if (finalizeError || finalized !== true) {
    console.error("phone-verification-check: finalize_phone_verification échoué", finalizeError);
    return jsonResponse({ ok: false, reason: "check_failed" }, 500);
  }

  const supabasePhone = toSupabasePhone(phone);
  const oneTimePassword = crypto.randomUUID() + crypto.randomUUID();

  const { data: existingUserId, error: lookupError } = await supabase.rpc("find_user_id_by_phone", {
    _phone: supabasePhone,
  });
  if (lookupError) {
    console.error("phone-verification-check: find_user_id_by_phone échoué", lookupError);
    return jsonResponse({ ok: false, reason: "account_failed" }, 500);
  }

  if (existingUserId) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(existingUserId, {
      password: oneTimePassword,
      phone_confirm: true,
    });
    if (updateError) {
      console.error("phone-verification-check: updateUserById échoué", updateError);
      return jsonResponse({ ok: false, reason: "account_failed" }, 500);
    }
  } else {
    const { error: createError } = await supabase.auth.admin.createUser({
      phone: supabasePhone,
      password: oneTimePassword,
      phone_confirm: true,
    });
    if (createError) {
      console.error("phone-verification-check: createUser échoué", createError);
      return jsonResponse({ ok: false, reason: "account_failed" }, 500);
    }
  }

  const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: signIn, error: signInError } = await anonClient.auth.signInWithPassword({
    phone: supabasePhone,
    password: oneTimePassword,
  });
  if (signInError || !signIn.session) {
    console.error("phone-verification-check: signInWithPassword échoué", signInError);
    return jsonResponse({ ok: false, reason: "account_failed" }, 500);
  }

  return jsonResponse({
    ok: true,
    is_new_account: !existingUserId,
    session: {
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    },
  });
});
