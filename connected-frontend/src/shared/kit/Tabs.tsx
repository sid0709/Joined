"use client";

import { SegmentedControl, SegmentedControlItem } from "@openseat/design-system";

interface TabsProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}

export function Tabs<T extends string>({ label, value, onChange, options }: TabsProps<T>) {
  return (
    <div className="hx-tabs">
      <SegmentedControl label={label} value={value} onChange={(next) => onChange(next as T)}>
        {options.map((option) => (
          <SegmentedControlItem key={option.value} value={option.value} label={option.label} />
        ))}
      </SegmentedControl>
    </div>
  );
}
