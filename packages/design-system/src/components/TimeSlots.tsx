"use client";

import type { ControlSize } from "./size";
import { displayTime, fromMinutes, minutesOf, range, type HourCycle } from "./time";

/** Where the day splits when `grouped` is on, in minutes since midnight. */
const DAY_PARTS = [
  { label: "Morning", from: 0 },
  { label: "Afternoon", from: 12 * 60 },
  { label: "Evening", from: 17 * 60 },
] as const;

export interface TimeSlotsProps {
  value: string;
  onChange?: (value: string) => void;
  /** First slot, "HH:mm". */
  start?: string;
  /** Last slot, inclusive. */
  end?: string;
  /** Minutes between slots. */
  interval?: number;
  hourCycle?: HourCycle;
  /** Slots that exist but can't be booked. */
  unavailable?: string[];
  /** Splits the list under Morning / Afternoon / Evening. */
  grouped?: boolean;
  size?: ControlSize;
  disabled?: boolean;
}

/** A grid of bookable times — pick one tap, see what's taken at a glance. */
export function TimeSlots({
  value,
  onChange,
  start = "09:00",
  end = "17:00",
  interval = 30,
  hourCycle = "12h",
  unavailable = [],
  grouped = false,
  size = "md",
  disabled,
}: TimeSlotsProps) {
  const slots = range(minutesOf(start), minutesOf(end), interval).map(fromMinutes);
  const groups = grouped
    ? DAY_PARTS.map((part, index) => ({
        label: part.label,
        slots: slots.filter((slot) => {
          const at = minutesOf(slot);
          return at >= part.from && at < (DAY_PARTS[index + 1]?.from ?? Infinity);
        }),
      })).filter((group) => group.slots.length > 0)
    : [{ label: "", slots }];

  return (
    <div className={`os-slots os-slots-${size}`} role="radiogroup" aria-label="Available times">
      {groups.map((group) => (
        <div key={group.label || "all"} className="os-slots-group">
          {group.label && <p className="os-slots-heading">{group.label}</p>}
          <div className="os-slots-grid">
            {group.slots.map((slot) => {
              const taken = unavailable.includes(slot);
              return (
                <button
                  key={slot}
                  type="button"
                  role="radio"
                  aria-checked={slot === value}
                  className="os-slot"
                  disabled={disabled || taken}
                  onClick={() => onChange?.(slot)}
                >
                  {displayTime(slot, hourCycle)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
