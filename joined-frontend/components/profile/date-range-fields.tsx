"use client";

import { CheckboxInput, Grid, NumberInput, Selector, Stack } from "sid-ui";
import { MAX_YEAR, MIN_YEAR, MONTH_OPTIONS } from "@/lib/profile-options";
import type { DateRange } from "@/lib/profile";

const FIELD_MIN_WIDTH = 120;

/** Start and end month/year of a role or school, with an "ongoing" switch. */
export function DateRangeFields({
  value,
  onChange,
  currentLabel,
}: {
  value: DateRange;
  onChange: (value: DateRange) => void;
  currentLabel: string;
}) {
  const set = (patch: Partial<DateRange>) => onChange({ ...value, ...patch });
  const month = (n: number) => (n ? String(n) : null);

  return (
    <Stack gap={3}>
      <Grid columns={{ minWidth: FIELD_MIN_WIDTH, repeat: "fit" }} gap={3}>
        <Selector
          label="Start month"
          options={MONTH_OPTIONS}
          value={month(value.startMonth)}
          onChange={(next) => set({ startMonth: Number(next ?? 0) })}
          hasClear
          isOptional
        />
        <NumberInput
          label="Start year"
          value={value.startYear || null}
          onChange={(next) => set({ startYear: next ?? 0 })}
          min={MIN_YEAR}
          max={MAX_YEAR}
          isIntegerOnly
          hasClear
        />
        <Selector
          label="End month"
          options={MONTH_OPTIONS}
          value={value.current ? null : month(value.endMonth)}
          onChange={(next) => set({ endMonth: Number(next ?? 0) })}
          hasClear
          isOptional
          isDisabled={value.current}
        />
        <NumberInput
          label="End year"
          value={value.current ? null : value.endYear || null}
          onChange={(next) => set({ endYear: next ?? 0 })}
          min={MIN_YEAR}
          max={MAX_YEAR}
          isIntegerOnly
          hasClear
          isDisabled={value.current}
        />
      </Grid>
      <CheckboxInput
        label={currentLabel}
        value={Boolean(value.current)}
        onChange={(current) => set({ current, ...(current ? { endMonth: 0, endYear: 0 } : {}) })}
      />
    </Stack>
  );
}
