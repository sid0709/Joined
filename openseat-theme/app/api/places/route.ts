const GEOAPIFY_AUTOCOMPLETE = "https://api.geoapify.com/v1/geocode/autocomplete";
const PLACES_MIN_TEXT = 3;
const PLACES_LIMIT = 8;

type GeoResult = {
  place_id?: string;
  formatted?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  state_code?: string;
  postcode?: string;
  housenumber?: string;
  street?: string;
  lat?: number;
  lon?: number;
};

/** Proxy Geoapify autocomplete so the API key never reaches the browser. */
export async function GET(request: Request) {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) {
    return Response.json(
      { error: "Address search is not configured", results: [] },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "city" ? "city" : "address";
  const text = url.searchParams.get("text")?.trim() ?? "";
  if (text.length < PLACES_MIN_TEXT) {
    return Response.json({ results: [] });
  }

  const upstream = new URL(GEOAPIFY_AUTOCOMPLETE);
  upstream.searchParams.set("text", text);
  upstream.searchParams.set("format", "json");
  upstream.searchParams.set("limit", String(PLACES_LIMIT));
  upstream.searchParams.set("apiKey", key);
  if (kind === "city") upstream.searchParams.set("type", "city");

  const response = await fetch(upstream, { cache: "no-store" });
  if (!response.ok) {
    return Response.json({ error: "Address search failed", results: [] }, { status: 502 });
  }

  const body = (await response.json()) as { results?: GeoResult[] };
  const results = (body.results ?? [])
    .map((hit) => toPlace(hit, kind))
    .filter((hit) => hit.label.length > 0);

  return Response.json({ results });
}

function toPlace(hit: GeoResult, kind: "city" | "address") {
  const city = hit.city?.trim() ?? "";
  const state = (hit.state_code || hit.state || "").trim();
  const street = [hit.housenumber, hit.street].filter(Boolean).join(" ").trim();
  const line1 = street || hit.address_line1?.trim() || "";
  const label =
    kind === "city"
      ? [city, state].filter(Boolean).join(", ")
      : hit.formatted?.trim() || [line1, city, state].filter(Boolean).join(", ");
  const id = hit.place_id || `${hit.lat ?? ""},${hit.lon ?? ""},${label}`;
  return {
    id,
    label,
    line1: kind === "city" ? "" : line1,
    city,
    state,
    postalCode: hit.postcode?.trim() ?? "",
  };
}
