"use client";

import { Selector } from "./DataInput";
import { US_STATES } from "./places";

const OPTIONS = US_STATES.map((state) => ({
  value: state.abbreviation,
  label: state.name,
  description: state.abbreviation,
}));

/** A searchable list of US states. The value is the postal abbreviation. */
export function StateSelector({
  label,
  value,
  onChange,
  isLabelHidden,
  isDisabled,
}: {
  label: string;
  value: string;
  onChange: (state: string) => void;
  isLabelHidden?: boolean;
  isDisabled?: boolean;
}) {
  return (
    <Selector
      label={label}
      isLabelHidden={isLabelHidden}
      options={OPTIONS}
      value={value}
      onChange={onChange}
      hasSearch
      searchPlaceholder="Search states"
      placeholder="Select a state"
      isDisabled={isDisabled}
    />
  );
}
