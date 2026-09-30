"use client";

import { useMemo } from "react";

import { CitySelector } from "./CitySelector";
import { TextInput, Typeahead } from "./DataInput";
import { emptyAddress, formatAddress, type Address } from "./places";
import {
  PLACES_DEBOUNCE_MS,
  PLACES_MIN_QUERY,
  PlacesCredit,
  placeItem,
  placeSearch,
} from "./places-search";
import { Stack } from "./Primitives";
import { StateSelector } from "./StateSelector";

/** Suggest real addresses as someone types, then keep street, city, state, and ZIP. */
export function AddressSelector({
  label,
  value,
  onChange,
  isDisabled,
}: {
  label: string;
  value: Address;
  onChange: (address: Address) => void;
  isDisabled?: boolean;
}) {
  const source = useMemo(() => placeSearch("address"), []);
  const countries = useMemo(() => placeSearch("country"), []);
  const formatted = formatAddress(value);
  const set =
    <K extends keyof Address>(key: K) =>
    (next: Address[K]) => {
      onChange({ ...value, [key]: next });
    };

  return (
    <Stack gap={3}>
      <Typeahead
        label={label}
        searchSource={source}
        value={placeItem(formatted, value)}
        onChange={(hit) => onChange(hit?.auxiliaryData ?? emptyAddress())}
        placeholder="Start typing an address"
        minQueryLength={PLACES_MIN_QUERY}
        debounceMs={PLACES_DEBOUNCE_MS}
        emptySearchResultsText="No addresses match."
        isDisabled={isDisabled}
        description="Pick a suggestion to fill the street, city, state, and ZIP."
      />
      <PlacesCredit />
      <TextInput
        label={`${label} street`}
        value={value.line1}
        onChange={set("line1")}
        placeholder="Street address"
        isDisabled={isDisabled}
      />
      <CitySelector
        label={`${label} city`}
        value={value.city}
        onChange={set("city")}
        placeholder="City"
        isDisabled={isDisabled}
      />
      <StateSelector
        label={`${label} state`}
        value={value.state}
        onChange={set("state")}
        isDisabled={isDisabled}
      />
      <TextInput
        label={`${label} postal code`}
        value={value.postalCode}
        onChange={set("postalCode")}
        placeholder="ZIP code"
        isDisabled={isDisabled}
      />
      <Typeahead
        label={`${label} country`}
        searchSource={countries}
        value={placeItem(value.country)}
        onChange={(hit) =>
          onChange({
            ...value,
            country: hit?.auxiliaryData?.country || hit?.label || "",
          })
        }
        placeholder="Search countries"
        minQueryLength={PLACES_MIN_QUERY}
        debounceMs={PLACES_DEBOUNCE_MS}
        emptySearchResultsText="No countries match."
        isDisabled={isDisabled}
      />
    </Stack>
  );
}
