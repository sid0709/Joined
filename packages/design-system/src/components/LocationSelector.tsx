"use client";

import { useMemo } from "react";

import { Typeahead } from "./DataInput";
import {
  PLACES_DEBOUNCE_MS,
  PLACES_MIN_QUERY,
  PlacesCredit,
  placeItem,
  placeSearch,
} from "./places-search";
import { Stack } from "./Primitives";

/** Search a city, a state, or a country. The saved value is the chosen label. */
export function LocationSelector({
  label,
  value,
  onChange,
  isLabelHidden,
  isDisabled,
  placeholder = "City, state, or country",
}: {
  label: string;
  value: string;
  onChange: (location: string) => void;
  isLabelHidden?: boolean;
  isDisabled?: boolean;
  placeholder?: string;
}) {
  const source = useMemo(() => placeSearch("location"), []);
  return (
    <Stack gap={1}>
      <Typeahead
        label={label}
        isLabelHidden={isLabelHidden}
        isDisabled={isDisabled}
        searchSource={source}
        value={placeItem(value)}
        onChange={(place) => onChange(place?.label ?? "")}
        placeholder={placeholder}
        minQueryLength={PLACES_MIN_QUERY}
        debounceMs={PLACES_DEBOUNCE_MS}
        emptySearchResultsText="No places match."
      />
      <PlacesCredit />
    </Stack>
  );
}
