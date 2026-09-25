"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ControlSize } from "./size";
import {
  HOURS_PER_HALF,
  MINUTES_PER_HOUR,
  from12,
  meridiemOf,
  pad2,
  parseTime,
  formatTime,
  to12,
  type HourCycle,
  type Meridiem,
  type MinuteStep,
  type TimeUnit,
} from "./time";

/** Ring radii as a percent of the face. The 24-hour inner ring holds 00 and 13–23. */
const OUTER_RING = 38;
const INNER_RING = 25;
const RING_SPLIT = (OUTER_RING + INNER_RING) / 2;
const LABEL_STEP = 5;
const FULL_TURN = 360;
const QUARTER_TURN = 90;
const HOUR_LABELS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const INNER_LABELS = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

export interface TimeDialProps {
  value: string;
  onChange?: (value: string) => void;
  hourCycle?: HourCycle;
  withSeconds?: boolean;
  /** Minute snapping. Drag lands on any multiple; labels show every five. */
  minuteStep?: MinuteStep;
  size?: ControlSize;
  disabled?: boolean;
  /** Accessible name for the dial. */
  label?: string;
}

function point(index: number, total: number, radius: number) {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
}

/** An analog face. Tap or drag the hand; hours hand off to minutes automatically. */
export function TimeDial({
  value,
  onChange,
  hourCycle = "12h",
  withSeconds = false,
  minuteStep = 5,
  size = "md",
  disabled,
  label = "Time",
}: TimeDialProps) {
  const parts = parseTime(value) ?? { h: 0, m: 0, s: 0 };
  const [unit, setUnit] = useState<TimeUnit>("hour");
  const [dragging, setDragging] = useState(false);
  const faceRef = useRef<HTMLDivElement>(null);
  const meridiem = meridiemOf(parts.h);
  const inner = hourCycle === "24h" && (parts.h === 0 || parts.h > HOURS_PER_HALF);

  function commit(next: Partial<typeof parts>) {
    onChange?.(formatTime({ ...parts, ...next }, withSeconds));
  }

  function pick(clientX: number, clientY: number) {
    const rect = faceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const degrees = (Math.atan2(dy, dx) * 180) / Math.PI + QUARTER_TURN;
    const turn = ((degrees % FULL_TURN) + FULL_TURN) % FULL_TURN;
    const distance = (Math.hypot(dx, dy) / rect.width) * 100;

    if (unit === "hour") {
      const slot = Math.round(turn / (FULL_TURN / HOURS_PER_HALF)) % HOURS_PER_HALF;
      if (hourCycle === "24h") commit({ h: distance < RING_SPLIT ? INNER_LABELS[slot] : slot === 0 ? 12 : slot });
      else commit({ h: from12(slot === 0 ? HOURS_PER_HALF : slot, meridiem) });
    } else {
      const snap = unit === "minute" ? minuteStep : 1;
      const raw = Math.round(turn / (FULL_TURN / MINUTES_PER_HOUR) / snap) * snap;
      commit(unit === "minute" ? { m: raw % MINUTES_PER_HOUR } : { s: raw % MINUTES_PER_HOUR });
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    pick(event.clientX, event.clientY);
  }

  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (unit === "hour") setUnit("minute");
    else if (unit === "minute" && withSeconds) setUnit("second");
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[event.key];
    if (event.key === "Enter") {
      event.preventDefault();
      setUnit(unit === "hour" ? "minute" : unit === "minute" && withSeconds ? "second" : "hour");
      return;
    }
    if (!delta) return;
    event.preventDefault();
    if (unit === "hour") commit({ h: parts.h + delta });
    else if (unit === "minute") commit({ m: parts.m + delta * minuteStep });
    else commit({ s: parts.s + delta });
  }

  const handTurn =
    unit === "hour"
      ? (parts.h % HOURS_PER_HALF) * (FULL_TURN / HOURS_PER_HALF)
      : (unit === "minute" ? parts.m : parts.s) * (FULL_TURN / MINUTES_PER_HOUR);
  const handLength = unit === "hour" && inner ? INNER_RING : OUTER_RING;
  const active = unit === "hour" ? parts.h : unit === "minute" ? parts.m : parts.s;
  const onLabel = unit !== "hour" && active % LABEL_STEP !== 0;
  const hourText = hourCycle === "12h" ? pad2(to12(parts.h)) : pad2(parts.h);
  const unitValue = { hour: hourText, minute: pad2(parts.m), second: pad2(parts.s) }[unit];

  function meridiemButton(option: Meridiem) {
    return (
      <button
        key={option}
        type="button"
        className="os-dial-meridiem"
        aria-pressed={meridiem === option}
        disabled={disabled}
        onClick={() => meridiem !== option && commit({ h: parts.h + (option === "PM" ? HOURS_PER_HALF : -HOURS_PER_HALF) })}
      >
        {option}
      </button>
    );
  }

  function unitButton(target: TimeUnit, text: string) {
    return (
      <button type="button" className="os-dial-unit" aria-pressed={unit === target} disabled={disabled} onClick={() => setUnit(target)}>
        {text}
      </button>
    );
  }

  return (
    <div className={["os-dial", `os-dial-${size}`, disabled && "os-dial-disabled"].filter(Boolean).join(" ")}>
      <div className="os-dial-readout">
        <div className="os-dial-digits">
          {unitButton("hour", hourText)}
          <span className="os-dial-colon">:</span>
          {unitButton("minute", pad2(parts.m))}
          {withSeconds && (
            <>
              <span className="os-dial-colon">:</span>
              {unitButton("second", pad2(parts.s))}
            </>
          )}
        </div>
        {hourCycle === "12h" && <div className="os-dial-meridiems">{(["AM", "PM"] as const).map(meridiemButton)}</div>}
      </div>

      <div
        ref={faceRef}
        className={dragging ? "os-dial-face os-dial-dragging" : "os-dial-face"}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${label}, ${unit}`}
        aria-valuetext={`${unit} ${unitValue}`}
        aria-valuenow={active}
        aria-disabled={disabled || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={(event) => dragging && pick(event.clientX, event.clientY)}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={onKeyDown}
      >
        <svg className="os-dial-hand" viewBox="0 0 100 100" aria-hidden>
          <g style={{ transform: `rotate(${handTurn}deg)` }}>
            <line x1="50" y1="50" x2="50" y2={50 - handLength} />
            <circle className="os-dial-knob" cx="50" cy={50 - handLength} r="6.5" />
            {onLabel && <circle className="os-dial-knob-dot" cx="50" cy={50 - handLength} r="1.3" />}
          </g>
          <circle className="os-dial-hub" cx="50" cy="50" r="1.8" />
        </svg>

        {unit === "hour"
          ? HOUR_LABELS.map((hour, index) => {
              const at = point(index, HOURS_PER_HALF, OUTER_RING);
              const on = hourCycle === "12h" ? to12(parts.h) === hour : !inner && parts.h === hour;
              return (
                <span key={hour} className={on ? "os-dial-label os-dial-label-on" : "os-dial-label"} style={{ left: `${at.x}%`, top: `${at.y}%` }}>
                  {hourCycle === "24h" ? pad2(hour) : hour}
                </span>
              );
            })
          : HOUR_LABELS.map((_, index) => {
              const mark = index * LABEL_STEP;
              const at = point(index, HOURS_PER_HALF, OUTER_RING);
              return (
                <span key={mark} className={active === mark ? "os-dial-label os-dial-label-on" : "os-dial-label"} style={{ left: `${at.x}%`, top: `${at.y}%` }}>
                  {pad2(mark)}
                </span>
              );
            })}
        {unit === "hour" &&
          hourCycle === "24h" &&
          INNER_LABELS.map((hour, index) => {
            const at = point(index, HOURS_PER_HALF, INNER_RING);
            return (
              <span
                key={hour}
                className={parts.h === hour ? "os-dial-label os-dial-label-inner os-dial-label-on" : "os-dial-label os-dial-label-inner"}
                style={{ left: `${at.x}%`, top: `${at.y}%` }}
              >
                {pad2(hour)}
              </span>
            );
          })}
      </div>
    </div>
  );
}
