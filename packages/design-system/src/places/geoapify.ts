const GEOAPIFY_AUTOCOMPLETE = "https://api.geoapify.com/v1/geocode/autocomplete";
const PLACES_LIMIT = 8;

/** Wait until a few characters are typed before calling Geoapify. */
export const PLACES_MIN_TEXT = 3;

export type PlaceKind = "city" | "address";

export type PlaceResult = {
  id: string;
  label: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type GeoResult = {
  place_id?: string;
  formatted?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  state_code?: string;
  postcode?: string;
  country?: string;
  housenumber?: string;
  street?: string;
  lat?: number;
  lon?: number;
};

/** Next.js route body. Pass `process.env.GEOAPIFY_API_KEY` so the key stays on the server. */
export async function placesResponse(
  request: Request,
  apiKey: string | undefined,
): Promise<Response> {
  const key = apiKey?.trim();
  if (!key) {
    return Response.json(
      { error: "Address search is not configured", results: [] },
      { status: 503 },
    );
  }
  const url = new URL(request.url);
  const kind: PlaceKind = url.searchParams.get("kind") === "city" ? "city" : "address";
  const text = url.searchParams.get("text")?.trim() ?? "";
  try {
    const results = await searchPlaces(key, kind, text);
    return Response.json({ results });
  } catch {
    return Response.json({ error: "Address search failed", results: [] }, { status: 502 });
  }
}

/** Geoapify autocomplete. The API key stays on the server that calls this. */
export async function searchPlaces(
  apiKey: string,
  kind: PlaceKind,
  text: string,
): Promise<PlaceResult[]> {
  const query = text.trim();
  if (query.length < PLACES_MIN_TEXT) return [];

  const upstream = new URL(GEOAPIFY_AUTOCOMPLETE);
  upstream.searchParams.set("text", query);
  upstream.searchParams.set("format", "json");
  upstream.searchParams.set("limit", String(PLACES_LIMIT));
  upstream.searchParams.set("apiKey", apiKey);
  if (kind === "city") upstream.searchParams.set("type", "city");

  const response = await fetch(upstream, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Address search failed");
  }
  const body = (await response.json()) as { results?: GeoResult[] };
  return (body.results ?? [])
    .map((hit) => toPlace(hit, kind))
    .filter((hit) => hit.label.length > 0);
}

function toPlace(hit: GeoResult, kind: PlaceKind): PlaceResult {
  const city = hit.city?.trim() ?? "";
  const state = (hit.state_code || hit.state || "").trim();
  const street = [hit.housenumber, hit.street].filter(Boolean).join(" ").trim();
  const line1 = street || hit.address_line1?.trim() || "";
  const label =
    kind === "city"
      ? [city, state].filter(Boolean).join(", ")
      : hit.formatted?.trim() || [line1, city, state].filter(Boolean).join(", ");
  return {
    id: hit.place_id || `${hit.lat ?? ""},${hit.lon ?? ""},${label}`,
    label,
    line1: kind === "city" ? "" : line1,
    city,
    state,
    postalCode: hit.postcode?.trim() ?? "",
    country: hit.country?.trim() ?? "",
  };
}
