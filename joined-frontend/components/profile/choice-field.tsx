"use client";

import { Selector } from "@joined/design-system";
import type { Option } from "@/lib/profile";

/** An optional, clearable choice whose empty value is "". */
export function ChoiceField({
  label,
  description,
  options,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Selector
      label={label}
      description={description}
      options={options}
      value={value || null}
      onChange={(next) => onChange(next ?? "")}
      placeholder="Not set"
      hasClear
      isOptional
    />
  );
}
