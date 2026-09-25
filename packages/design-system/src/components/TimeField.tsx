"use client";

import { useState } from "react";
import { Button } from "./Action";
import type { ControlSize } from "./size";
import { PickerShell } from "./PickerShell";
import { ChoiceSegment, NumberSegment, SegmentDivider } from "./Segment";
import { TimeColumns } from "./TimeColumns";
import { TimeDial } from "./TimeDial";
import { TimeSlots, type TimeSlotsProps } from "./TimeSlots";
import {
  HOURS_PER_HALF,
  MERIDIEMS,
  formatTime,
  from12,
  meridiemOf,
  pad2,
  parseTime,
  to12,
  type HourCycle,
  type Meridiem,
  type MinuteStep,
} from "./time";

export type TimePicker = "columns" | "dial" | "slots" | "none";

export interface TimeFieldProps {
  value: string;
  onChange?: (value: string) => void;
  hourCycle?: HourCycle;
  withSeconds?: boolean;
  minuteStep?: MinuteStep;
  /** What the dropdown shows. `none` makes a type-only field. */
  picker?: TimePicker;
  /** Passed through when `picker="slots"`. */
  slots?: Pick<TimeSlotsProps, "start" | "end" | "interval" | "unavailable" | "grouped">;
  size?: ControlSize;
  disabled?: boolean;
  error?: boolean;
  label?: string;
  labelledBy?: string;
}

interface Draft {
  hour: number | null;
  minute: number | null;
  second: number | null;
  meridiem: Meridiem | null;
}

function draftOf(value: string, hourCycle: HourCycle): Draft {
  const parts = parseTime(value);
  if (!parts) return { hour: null, minute: null, second: null, meridiem: null };
  return {
    hour: hourCycle === "12h" ? to12(parts.h) : parts.h,
    minute: parts.m,
    second: parts.s,
    meridiem: meridiemOf(parts.h),
  };
}

/** Type the time, or open the dropdown and pick it. Both stay in sync. */
export function TimeField({
  value,
  onChange,
  hourCycle = "12h",
  withSeconds = false,
  minuteStep = 5,
  picker = "columns",
  slots,
  size = "md",
  disabled,
  error,
  label = "Time",
  labelledBy,
}: TimeFieldProps) {
  const twelve = hourCycle === "12h";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => draftOf(value, hourCycle));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(draftOf(value, hourCycle));
  }

  function update(patch: Partial<Draft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    const empty = next.hour == null && next.minute == null && (!withSeconds || next.second == null);
    if (empty) return onChange?.("");
    if (next.hour == null || next.minute == null || (withSeconds && next.second == null)) return;
    const h = twelve ? from12(next.hour, next.meridiem ?? "AM") : next.hour;
    onChange?.(formatTime({ h, m: next.minute, s: next.second ?? 0 }, withSeconds));
  }

  function setNow() {
    const now = new Date();
    onChange?.(formatTime({ h: now.getHours(), m: now.getMinutes(), s: now.getSeconds() }, withSeconds));
  }

  const panelProps = { value, onChange, hourCycle, withSeconds, minuteStep, size, disabled };
  const panel =
    picker === "none" ? undefined : (
      <div className="os-picker-body">
        {picker === "columns" && <TimeColumns {...panelProps} />}
        {picker === "dial" && <TimeDial {...panelProps} label={label} />}
        {picker === "slots" && (
          <TimeSlots
            {...slots}
            value={value}
            hourCycle={hourCycle}
            size={size}
            onChange={(next) => {
              onChange?.(next);
              setOpen(false);
            }}
          />
        )}
        {picker !== "slots" && (
          <div className="os-picker-footer">
            <Button label="Now" variant="ghost" size="sm" onClick={setNow} />
            <Button label="Done" variant="primary" size="sm" onClick={() => setOpen(false)} />
          </div>
        )}
      </div>
    );

  return (
    <PickerShell
      open={open}
      onOpenChange={setOpen}
      icon="clock"
      label={label}
      labelledBy={labelledBy}
      size={size}
      error={error}
      disabled={disabled}
      panel={panel}
      segments={
        <>
          <NumberSegment
            label="Hour"
            value={draft.hour}
            min={twelve ? 1 : 0}
            max={twelve ? HOURS_PER_HALF : 23}
            digits={2}
            placeholder="--"
            disabled={disabled}
            format={twelve ? String : pad2}
            onChange={(hour) => update({ hour })}
          />
          <SegmentDivider>:</SegmentDivider>
          <NumberSegment
            label="Minute"
            value={draft.minute}
            min={0}
            max={59}
            digits={2}
            placeholder="--"
            disabled={disabled}
            onChange={(minute) => update({ minute })}
          />
          {withSeconds && (
            <>
              <SegmentDivider>:</SegmentDivider>
              <NumberSegment
                label="Second"
                value={draft.second}
                min={0}
                max={59}
                digits={2}
                placeholder="--"
                disabled={disabled}
                onChange={(second) => update({ second })}
              />
            </>
          )}
          {twelve && (
            <ChoiceSegment
              label="AM or PM"
              value={draft.meridiem}
              options={MERIDIEMS}
              placeholder="AM"
              disabled={disabled}
              onChange={(meridiem) => update({ meridiem })}
            />
          )}
        </>
      }
    />
  );
}
