"use client";

import { useId } from "react";
import type { FieldSize } from "./size";
import { TimeColumns } from "./TimeColumns";
import { TimeDial } from "./TimeDial";
import { TimeField, type TimePicker } from "./TimeField";
import { TimeSlots, type TimeSlotsProps } from "./TimeSlots";
import {
  HOURS_PER_HALF,
  MERIDIEMS,
  MINUTES_PER_HOUR,
  formatTime,
  from12,
  meridiemOf,
  pad2,
  parseTime,
  range,
  to12,
  type HourCycle,
  type MinuteStep,
} from "./time";

export type { HourCycle, MinuteStep } from "./time";

/**
 * field   — type it, or open a dropdown (columns, dial, or slots).
 * select  — one native dropdown per unit.
 * dial    — an analog face you tap or drag.
 * columns — scrolling wheels, always open.
 * slots   — a grid of bookable times.
 */
export type TimeInputVariant = "field" | "select" | "dial" | "columns" | "slots";

export interface TimeInputProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  variant?: TimeInputVariant;
  /** The dropdown inside `variant="field"`. */
  picker?: TimePicker;
  size?: FieldSize;
  hourCycle?: HourCycle;
  withSeconds?: boolean;
  minuteStep?: MinuteStep;
  slots?: Pick<TimeSlotsProps, "start" | "end" | "interval" | "unavailable" | "grouped">;
  disabled?: boolean;
  error?: boolean;
  helper?: string;
  description?: string;
}

function TimeSelects({
  value,
  onChange,
  hourCycle,
  withSeconds,
  minuteStep,
  size,
  disabled,
  error,
  labelledBy,
}: Required<Pick<TimeInputProps, "hourCycle" | "withSeconds" | "minuteStep" | "size">> &
  Pick<TimeInputProps, "value" | "onChange" | "disabled" | "error"> & { labelledBy: string }) {
  const parts = parseTime(value) ?? { h: 0, m: 0, s: 0 };
  const twelve = hourCycle === "12h";
  const cls = ["os-control", `os-control-${size}`, "os-time-select", error && "os-control-error", disabled && "os-control-disabled"]
    .filter(Boolean)
    .join(" ");

  function commit(next: Partial<typeof parts>) {
    onChange?.(formatTime({ ...parts, ...next }, withSeconds));
  }

  return (
    <div className="os-time-selects" role="group" aria-labelledby={labelledBy}>
      <span className={cls}>
        <select
          aria-label="Hour"
          disabled={disabled}
          value={twelve ? to12(parts.h) : parts.h}
          onChange={(e) => commit({ h: twelve ? from12(Number(e.target.value), meridiemOf(parts.h)) : Number(e.target.value) })}
        >
          {(twelve ? range(1, HOURS_PER_HALF) : range(0, 23)).map((h) => (
            <option key={h} value={h}>
              {twelve ? h : pad2(h)}
            </option>
          ))}
        </select>
      </span>
      <span className="os-segment-divider">:</span>
      <span className={cls}>
        <select aria-label="Minute" disabled={disabled} value={parts.m} onChange={(e) => commit({ m: Number(e.target.value) })}>
          {range(0, MINUTES_PER_HOUR - 1, minuteStep).map((m) => (
            <option key={m} value={m}>
              {pad2(m)}
            </option>
          ))}
        </select>
      </span>
      {withSeconds && (
        <>
          <span className="os-segment-divider">:</span>
          <span className={cls}>
            <select aria-label="Second" disabled={disabled} value={parts.s} onChange={(e) => commit({ s: Number(e.target.value) })}>
              {range(0, MINUTES_PER_HOUR - 1).map((s) => (
                <option key={s} value={s}>
                  {pad2(s)}
                </option>
              ))}
            </select>
          </span>
        </>
      )}
      {twelve && (
        <span className={cls}>
          <select
            aria-label="AM or PM"
            disabled={disabled}
            value={meridiemOf(parts.h)}
            onChange={(e) => commit({ h: from12(to12(parts.h), e.target.value as (typeof MERIDIEMS)[number]) })}
          >
            {MERIDIEMS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </span>
      )}
    </div>
  );
}

/** One time value, five ways to enter it. Every variant reads and writes "HH:mm". */
export function TimeInput({
  label,
  value,
  onChange,
  variant = "field",
  picker = "columns",
  size = "md",
  hourCycle = "12h",
  withSeconds = false,
  minuteStep = 5,
  slots,
  disabled,
  error,
  helper,
  description,
}: TimeInputProps) {
  const labelId = useId();
  const shared = { value, onChange, hourCycle, withSeconds, minuteStep, size, disabled };

  return (
    <div className={`os-field-group os-time-input os-time-input-${variant}`}>
      <span className="os-field-label" id={labelId}>
        {label}
      </span>
      {description && <p className="os-field-description">{description}</p>}
      {variant === "field" && <TimeField {...shared} picker={picker} slots={slots} error={error} label={label} labelledBy={labelId} />}
      {variant === "select" && <TimeSelects {...shared} error={error} labelledBy={labelId} />}
      {variant === "dial" && <TimeDial {...shared} label={label} />}
      {variant === "columns" && <TimeColumns {...shared} />}
      {variant === "slots" && <TimeSlots {...slots} value={value} onChange={onChange} hourCycle={hourCycle} size={size} disabled={disabled} />}
      {helper && <span className={error ? "os-field-helper-error" : "os-field-helper"}>{helper}</span>}
    </div>
  );
}
