"use client";

import { useState } from "react";
import { Button } from "./Action";
import { Calendar, type CalendarProps } from "./Calendar";
import type { ControlSize } from "./size";
import { PickerShell } from "./PickerShell";
import { NumberSegment, SegmentDivider } from "./Segment";
import { MONTHS_PER_YEAR, daysInMonth, startOfDay } from "./date";

const MIN_YEAR = 1;
const MAX_YEAR = 9999;
const LEAP_YEAR = 2024;

export interface DateFieldProps {
  value: Date | null;
  onChange?: (value: Date | null) => void;
  /** Type-only when false. */
  withCalendar?: boolean;
  /** Passed to the dropdown calendar — events, disabled days, week start. */
  calendar?: Pick<CalendarProps, "events" | "min" | "max" | "isDateDisabled" | "weekStartsOn" | "showWeekNumbers">;
  size?: ControlSize;
  disabled?: boolean;
  error?: boolean;
  label?: string;
  labelledBy?: string;
}

interface Draft {
  month: number | null;
  day: number | null;
  year: number | null;
}

function draftOf(value: Date | null): Draft {
  return value
    ? { month: value.getMonth() + 1, day: value.getDate(), year: value.getFullYear() }
    : { month: null, day: null, year: null };
}

/** Type a date as MM / DD / YYYY, or open the calendar and pick it. */
export function DateField({
  value,
  onChange,
  withCalendar = true,
  calendar,
  size = "md",
  disabled,
  error,
  label = "Date",
  labelledBy,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => draftOf(value));
  const [seen, setSeen] = useState(value?.getTime() ?? null);
  const stamp = value?.getTime() ?? null;
  if (seen !== stamp) {
    setSeen(stamp);
    setDraft(draftOf(value));
  }

  function update(patch: Partial<Draft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (next.month == null && next.day == null && next.year == null) return onChange?.(null);
    if (next.month == null || next.day == null || next.year == null) return;
    const day = Math.min(next.day, daysInMonth(next.year, next.month - 1));
    const date = new Date(next.year, next.month - 1, day);
    date.setFullYear(next.year);
    onChange?.(date);
  }

  const dayMax = daysInMonth(draft.year ?? LEAP_YEAR, (draft.month ?? 1) - 1);

  return (
    <PickerShell
      open={open}
      onOpenChange={setOpen}
      icon="calendar"
      label={label}
      labelledBy={labelledBy}
      size={size}
      error={error}
      disabled={disabled}
      panel={
        withCalendar ? (
          <div className="os-picker-body">
            <Calendar
              {...calendar}
              size="sm"
              value={value}
              onChange={(date) => {
                onChange?.(date);
                setOpen(false);
              }}
              footer={
                <div className="os-picker-footer">
                  <Button label="Clear" variant="ghost" size="sm" onClick={() => onChange?.(null)} />
                  <Button
                    label="Today"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      onChange?.(startOfDay(new Date()));
                      setOpen(false);
                    }}
                  />
                </div>
              }
            />
          </div>
        ) : undefined
      }
      segments={
        <>
          <NumberSegment
            label="Month"
            value={draft.month}
            min={1}
            max={MONTHS_PER_YEAR}
            digits={2}
            placeholder="MM"
            disabled={disabled}
            onChange={(month) => update({ month })}
          />
          <SegmentDivider>/</SegmentDivider>
          <NumberSegment
            label="Day"
            value={draft.day}
            min={1}
            max={dayMax}
            digits={2}
            placeholder="DD"
            disabled={disabled}
            onChange={(day) => update({ day })}
          />
          <SegmentDivider>/</SegmentDivider>
          <NumberSegment
            label="Year"
            value={draft.year}
            min={MIN_YEAR}
            max={MAX_YEAR}
            digits={4}
            placeholder="YYYY"
            disabled={disabled}
            onChange={(year) => update({ year })}
          />
        </>
      }
    />
  );
}
