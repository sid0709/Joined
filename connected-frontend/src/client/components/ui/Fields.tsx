"use client";

import { DateInput, NumberInput, type DateInputProps } from "@openseat/design-system";

type IsoDate = NonNullable<DateInputProps["value"]>;

interface NumberFieldProps {
  label: string;
  /** Held as a string so a half-typed number never breaks a form. */
  value: string;
  onChange: (value: string) => void;
  helper?: string;
  min?: number;
  step?: number;
}

export function NumberField({ label, value, onChange, helper, min = 0, step }: NumberFieldProps) {
  return (
    <NumberInput
      label={label}
      description={helper}
      value={value === "" ? undefined : Number(value)}
      min={min}
      step={step}
      onChange={(next) => onChange(String(next))}
    />
  );
}

interface DateFieldProps {
  label: string;
  /** ISO calendar date, YYYY-MM-DD. */
  value: string;
  onChange: (value: string) => void;
}

export function DateField({ label, value, onChange }: DateFieldProps) {
  return (
    <DateInput label={label} value={value as IsoDate} onChange={(next) => next && onChange(next)} />
  );
}
