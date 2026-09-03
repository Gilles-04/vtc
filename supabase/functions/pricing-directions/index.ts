// Calcule la distance et la durée réelles d'un trajet via Google Directions
// API (clé jamais exposée au client — voir docs/02-architecture-technique.md,
// choix Google Maps vs Mapbox encore à confirmer), puis applique la
// tarification (`estimate_ride_fare`) pour renvoyer un prix figé au client
// en un seul aller-retour.
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse, handleCorsPreflight } from "../_shared/cors.ts";

interface LatLng {
  lat: number;
  lng: number;
}

interface DirectionsResult {
  distance_km: number;
  duration_min: number;
}

async function fetchGoogleDirections(pickup: LatLng, dropoff: LatLng, apiKey: string): Promise<DirectionsResult> {
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", `${pickup.lat},${pickup.lng}`);
  url.searchParams.set("destination", `${dropoff.lat},${dropoff.lng}`);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Directions a répondu ${res.status}`);
  }
  const body = await res.json();
  const leg = body?.routes?.[0]?.legs?.[0];
  if (body?.status !== "OK" || !leg) {
    throw new Error(`Google Directions : statut ${body?.status ?? "inconnu"}`);
  }

  return {
    distance_km: leg.distance.value / 1000,
    duration_min: leg.duration.value / 60,
  };
}

function parseLatLng(value: unknown): LatLng | null {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v.lat !== "number" || typeof v.lng !== "number") {
    return null;
  }
  return { lat: v.lat, lng: v.lng };
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "not_configured" }, 500);
  }

  const body = await req.json().catch(() => null);
  const pickup = parseLatLng(body?.pickup);
  const dropoff = parseLatLng(body?.dropoff);
  const zoneId = typeof body?.zone_id === "string" ? body.zone_id : null;
  const category = body?.category === "car" || body?.category === "moto" ? body.category : null;

  if (!pickup || !dropoff) {
    return jsonResponse({ error: "invalid_coordinates" }, 400);
  }
  if (!category) {
    return jsonResponse({ error: "invalid_category" }, 400);
  }

  let directions: DirectionsResult;
  try {
    directions = await fetchGoogleDirections(pickup, dropoff, apiKey);
  } catch (err) {
    console.error("pricing-directions: échec Directions API", err);
    return jsonResponse({ error: "directions_failed" }, 502);
  }

  const supabase = createAdminClient();
  const { data: estimate, error } = await supabase
    .rpc("estimate_ride_fare", {
      _distance_km: directions.distance_km,
      _duration_min: directions.duration_min,
      _category: category,
      _zone_id: zoneId,
    })
    .single();

  if (error || !estimate) {
    console.error("pricing-directions: estimate_ride_fare échoué", error);
    return jsonResponse({ error: "pricing_failed" }, 502);
  }

  return jsonResponse({
    distance_km: Math.round(directions.distance_km * 10) / 10,
    duration_min: Math.round(directions.duration_min),
    ...estimate,
  });
});
