"use client";

import type { SearchableItem, SearchSource } from "./DataInput";
import { Link } from "./Action";
import { Text } from "./Primitives";
import type { Address } from "./places";

/** Wait until a few characters are typed, then ask Geoapify once. */
export const PLACES_MIN_QUERY = 3;
export const PLACES_DEBOUNCE_MS = 300;
export const PLACES_PATH = "/api/places";
export const GEOAPIFY_ATTRIBUTION_HREF = "https://www.geoapify.com/";

export type PlaceHit = Address & {
  id: string;
  label: string;
};

type PlaceItem = SearchableItem<Address>;

/** Geoapify autocomplete, proxied by the app so the API key stays on the server. */
export function placeSearch(kind: "city" | "address"): SearchSource<PlaceItem> {
  let controller: AbortController | null = null;
  return {
    bootstrap: () => [],
    cancel() {
      controller?.abort();
    },
    async search(query) {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      const params = new URLSearchParams({ kind, text: query });
      try {
        const response = await fetch(`${PLACES_PATH}?${params}`, { signal });
        if (!response.ok) return [];
        const body = (await response.json()) as { results?: PlaceHit[] };
        return (body.results ?? []).map((hit) => ({
          id: hit.id,
          label: hit.label,
          auxiliaryData: {
            line1: hit.line1,
            city: hit.city,
            state: hit.state,
            postalCode: hit.postalCode,
          },
        }));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        return [];
      }
    },
  };
}

export function placeItem(label: string, address?: Address): PlaceItem | null {
  const text = label.trim();
  if (!text) return null;
  return { id: text, label: text, auxiliaryData: address };
}

/** Free Geoapify plans require a visible credit. */
export function PlacesCredit() {
  return (
    <Text type="supporting" color="secondary">
      Address data © <Link href={GEOAPIFY_ATTRIBUTION_HREF}>Geoapify</Link>
    </Text>
  );
}
