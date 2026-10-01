import { placesResponse } from "@openseat/design-system/geoapify";

/** Proxy Geoapify autocomplete so the API key never reaches the browser. */
export function GET(request: Request) {
  return placesResponse(request, process.env.GEOAPIFY_API_KEY);
}
