"use client";

import { useMemo } from "react";
import { Stack } from "./Primitives";
import { Tokenizer, Typeahead, type SearchableItem } from "./DataInput";
import type { Address } from "./places";
import {
  PLACES_DEBOUNCE_MS,
  PLACES_MIN_QUERY,
  PlacesCredit,
  placeItem,
  placeSearch,
} from "./places-search";

type Common = {
  label: string;
  isLabelHidden?: boolean;
  isDisabled?: boolean;
  placeholder?: string;
};

type SingleProps = Common & {
  multiple?: false;
  value: string;
  onChange: (city: string) => void;
};

type MultipleProps = Common & {
  multiple: true;
  value: string[];
  onChange: (cities: string[]) => void;
};

/** Search cities with Geoapify as the person types, or pick several. */
export function CitySelector(props: SingleProps | MultipleProps) {
  const source = useMemo(() => placeSearch("city"), []);
  const placeholder = props.placeholder ?? (props.multiple ? "Add a city" : "Search cities");

  if (props.multiple) {
    const selected = props.value
      .map((label) => placeItem(label))
      .filter((city): city is SearchableItem<Address> => city != null);
    return (
      <Stack gap={1}>
        <Tokenizer
          label={props.label}
          isLabelHidden={props.isLabelHidden}
          isDisabled={props.isDisabled}
          searchSource={source}
          value={selected}
          onChange={(items) => props.onChange(items.map((item) => item.label))}
          placeholder={placeholder}
          minQueryLength={PLACES_MIN_QUERY}
          debounceMs={PLACES_DEBOUNCE_MS}
          emptySearchResultsText="No cities match."
        />
        <PlacesCredit />
      </Stack>
    );
  }

  return (
    <Stack gap={1}>
      <Typeahead
        label={props.label}
        isLabelHidden={props.isLabelHidden}
        isDisabled={props.isDisabled}
        searchSource={source}
        value={placeItem(props.value)}
        onChange={(city) => props.onChange(city?.label ?? "")}
        placeholder={placeholder}
        minQueryLength={PLACES_MIN_QUERY}
        debounceMs={PLACES_DEBOUNCE_MS}
        emptySearchResultsText="No cities match."
      />
      <PlacesCredit />
    </Stack>
  );
}
