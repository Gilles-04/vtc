// Réception des webhooks du fournisseur Mobile Money — couvre deux flux
// distincts partageant la même infrastructure de déduplication/signature
// (voir docs/10-paiements.md) : paiement d'abonnement chauffeur
// (purpose='driver_subscription') et paiement de course
// (purpose='ride_fare'). Aucun fournisseur n'est encore choisi : la forme
// exacte du payload et de la signature est donc volontairement isolée
// dans les fonctions marquées « À ADAPTER » ci-dessous — le reste
// (déduplication, re-vérification, activation) ne changera pas quel que
// soit le fournisseur retenu.
//
// Principe non négociable (voir docs/10-paiements.md) : on ne fait
// jamais confiance au seul contenu du webhook. Après vérification de la
// signature, on rappelle l'API du fournisseur pour confirmer le montant
// et le statut réels avant d'activer quoi que ce soit.

import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";

interface NormalizedWebhookEvent {
  eventKey: string;
  paymentId: string;
  providerRef: string;
  status: "success" | "failed";
}

// À ADAPTER : forme réelle du payload du fournisseur retenu. Le payload
// générique ci-dessous suppose { event_id, payment_id, provider_ref,
// status } — à remplacer par le schéma réel une fois le fournisseur
// choisi (Flooz, T-Money, ou un agrégateur comme Semoa Togo).
function parseProviderPayload(payload: Record<string, unknown>): NormalizedWebhookEvent | null {
  const eventKey = payload.event_id;
  const paymentId = payload.payment_id;
  const providerRef = payload.provider_ref;
  const rawStatus = payload.status;

  if (typeof eventKey !== "string" || typeof paymentId !== "string" || typeof providerRef !== "string") {
    return null;
  }
  const status = rawStatus === "success" ? "success" : rawStatus === "failed" ? "failed" : null;
  if (!status) {
    return null;
  }

  return { eventKey, paymentId, providerRef, status };
}

// À ADAPTER : mécanisme de signature du fournisseur retenu (souvent un
// HMAC-SHA256 sur le corps brut, dans un en-tête `X-Signature` ou
// équivalent — c'est le schéma implémenté ici, à ajuster si le
// fournisseur utilise autre chose).
async function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): Promise<boolean> {
  if (!signatureHeader) {
    return false;
  }
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expected.length !== signatureHeader.length) {
    return false;
  }
  // Comparaison en temps constant — évite qu'une différence de timing ne
  // laisse deviner la signature attendue octet par octet.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const secret = Deno.env.get("PAYMENT_WEBHOOK_SECRET");
  if (!secret) {
    console.error("payment-webhook-momo: PAYMENT_WEBHOOK_SECRET non configuré");
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-signature");

  const validSignature = await verifySignature(rawBody, signatureHeader, secret);
  if (!validSignature) {
    return jsonResponse({ error: "invalid_signature" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const event = parseProviderPayload(payload);
  if (!event) {
    return jsonResponse({ error: "unrecognized_payload_shape" }, 400);
  }

  const supabase = createAdminClient();

  // Déduplication : un webhook rejoué (fréquent chez la plupart des
  // fournisseurs Mobile Money) ne doit jamais être traité deux fois.
  const { data: existing } = await supabase
    .from("payment_webhook_events")
    .select("id, processed_at")
    .eq("event_key", event.eventKey)
    .maybeSingle();

  if (existing?.processed_at) {
    return jsonResponse({ ok: true, deduplicated: true });
  }

  if (!existing) {
    const { error: insertError } = await supabase.from("payment_webhook_events").insert({
      provider: "flooz", // À ADAPTER : provider réel une fois choisi
      event_key: event.eventKey,
      payload,
      payment_id: event.paymentId,
    });
    if (insertError) {
      console.error("payment-webhook-momo: échec insertion payment_webhook_events", insertError);
      return jsonResponse({ error: "storage_failed" }, 500);
    }
  }

  // À ADAPTER : re-vérification auprès de l'API du fournisseur (jamais
  // confiance dans le seul contenu du webhook, voir docs/10-paiements.md).
  // Exemple :
  //   const verified = await fetch(`https://api.fournisseur.tg/payments/${event.providerRef}`, {
  //     headers: { Authorization: `Bearer ${Deno.env.get("MOMO_PROVIDER_API_KEY")}` },
  //   }).then((r) => r.json());
  //   if (verified.status !== event.status) { ... traiter comme suspect, ne pas activer ... }
  //   -> `verified.amount` doit remplacer `payment.amount_fcfa` ci-dessous
  //      dans l'appel à `confirm_ride_payment` une fois cet appel branché :
  //      c'est le montant confirmé par le fournisseur qui doit être vérifié,
  //      jamais notre propre valeur locale relue telle quelle.

  const { data: payment, error: paymentLookupError } = await supabase
    .from("payments")
    .select("purpose, ride_id, amount_fcfa")
    .eq("id", event.paymentId)
    .maybeSingle();

  if (paymentLookupError || !payment) {
    console.error("payment-webhook-momo: paiement introuvable", event.paymentId, paymentLookupError);
    return jsonResponse({ error: "payment_not_found" }, 404);
  }

  if (event.status === "success") {
    // Deux flux, deux fonctions de confirmation (voir docs/10-paiements.md
    // §Paiement de la course) : l'abonnement active/prolonge une
    // souscription, la course calcule les frais de service (2,5 %) et
    // déclenche la facturation automatique — jamais interchangeables.
    if (payment.purpose === "ride_fare") {
      const { error: confirmError } = await supabase.rpc("confirm_ride_payment", {
        _payment_id: event.paymentId,
        _provider_ref: event.providerRef,
        _confirmed_amount_fcfa: payment.amount_fcfa, // À ADAPTER : montant renvoyé par le fournisseur, voir note ci-dessus
        _expected_ride_id: payment.ride_id,
      });
      if (confirmError) {
        console.error("payment-webhook-momo: échec confirm_ride_payment", confirmError);
        return jsonResponse({ error: "confirmation_failed" }, 500);
      }
    } else {
      const { error: confirmError } = await supabase.rpc("confirm_subscription_payment", {
        _payment_id: event.paymentId,
        _provider_ref: event.providerRef,
      });
      if (confirmError) {
        console.error("payment-webhook-momo: échec confirm_subscription_payment", confirmError);
        return jsonResponse({ error: "confirmation_failed" }, 500);
      }
    }
  } else {
    await supabase
      .from("payments")
      .update({ status: "failed", provider_ref: event.providerRef })
      .eq("id", event.paymentId)
      .eq("status", "pending");

    // Un paiement de course échoué se répercute sur la course elle-même —
    // jamais un `payment_status='processing'` orphelin qui ne se résout
    // plus jamais côté client.
    if (payment.purpose === "ride_fare" && payment.ride_id) {
      await supabase.from("rides").update({ payment_status: "failed" }).eq("id", payment.ride_id);
    }
  }

  await supabase.from("payment_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_key", event.eventKey);

  return jsonResponse({ ok: true });
});
