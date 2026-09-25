"use client";

import type { ControlSize } from "./size";
import { useNow } from "./hooks";
import {
  HOURS_PER_HALF,
  MINUTES_PER_HOUR,
  SECONDS_PER_MINUTE,
  meridiemOf,
  pad2,
  parseTime,
  to12,
  type HourCycle,
  type TimeParts,
} from "./time";

/**
 * analog  — numerals, minute ticks, three hands.
 * minimal — twelve marks and two hands; calm enough for a sidebar.
 * digital — large tabular digits with a quiet caption.
 * compact — an inline pill for rows and headers.
 */
export type ClockVariant = "analog" | "minimal" | "digital" | "compact";

export interface ClockProps {
  /** A fixed "HH:mm[:ss]". Omit it for a live clock. */
  value?: string;
  variant?: ClockVariant;
  size?: ControlSize;
  hourCycle?: HourCycle;
  showSeconds?: boolean;
  /** IANA zone for a live clock, e.g. "Asia/Tokyo". Defaults to the viewer's. */
  timeZone?: string;
  /** Caption — a city, a room, a person. */
  label?: string;
}

const TICK_MS = 1000;
const DEGREES = 360;
const NUMERALS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const NUMERAL_RADIUS = 32;

function zoned(now: Date, timeZone?: string): TimeParts {
  if (!timeZone) return { h: now.getHours(), m: now.getMinutes(), s: now.getSeconds() };
  const pieces = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: string) => Number(pieces.find((piece) => piece.type === type)?.value ?? 0);
  return { h: read("hour"), m: read("minute"), s: read("second") };
}

function Hand({ turn, length, className }: { turn: number; length: number; className: string }) {
  return <line className={className} x1="50" y1="50" x2="50" y2={50 - length} style={{ transform: `rotate(${turn}deg)` }} />;
}

function Face({ parts, variant, showSeconds }: { parts: TimeParts; variant: "analog" | "minimal"; showSeconds: boolean }) {
  const minuteTurn = (parts.m + parts.s / SECONDS_PER_MINUTE) * (DEGREES / MINUTES_PER_HOUR);
  const hourTurn = ((parts.h % HOURS_PER_HALF) + parts.m / MINUTES_PER_HOUR) * (DEGREES / HOURS_PER_HALF);
  const secondTurn = parts.s * (DEGREES / SECONDS_PER_MINUTE);
  const marks = variant === "analog" ? MINUTES_PER_HOUR : HOURS_PER_HALF;

  return (
    <svg className="os-clock-face" viewBox="0 0 100 100" aria-hidden>
      <circle className="os-clock-rim" cx="50" cy="50" r="48" />
      {Array.from({ length: marks }, (_, i) => {
        const major = i % (marks / HOURS_PER_HALF) === 0;
        return (
          <line
            key={i}
            className={major ? "os-clock-mark os-clock-mark-major" : "os-clock-mark"}
            x1="50"
            y1={major ? 6 : 6.5}
            x2="50"
            y2={major ? 10 : 8}
            style={{ transform: `rotate(${(i * DEGREES) / marks}deg)` }}
          />
        );
      })}
      {variant === "analog" &&
        NUMERALS.map((n, i) => {
          const angle = (i / HOURS_PER_HALF) * Math.PI * 2 - Math.PI / 2;
          return (
            <text key={n} className="os-clock-numeral" x={50 + NUMERAL_RADIUS * Math.cos(angle)} y={50 + NUMERAL_RADIUS * Math.sin(angle)}>
              {n}
            </text>
          );
        })}
      <Hand className="os-clock-hour" turn={hourTurn} length={variant === "analog" ? 19 : 22} />
      <Hand className="os-clock-minute" turn={minuteTurn} length={variant === "analog" ? 29 : 33} />
      {showSeconds && <Hand className="os-clock-second" turn={secondTurn} length={36} />}
      <circle className="os-clock-pin" cx="50" cy="50" r="2" />
    </svg>
  );
}

/** Shows a time — fixed or live — in four treatments. It never takes input. */
export function Clock({ value, variant = "analog", size = "md", hourCycle = "12h", showSeconds = true, timeZone, label }: ClockProps) {
  const now = useNow(TICK_MS, value === undefined);
  const parts = value !== undefined ? parseTime(value) : now ? zoned(now, timeZone) : null;
  const twelve = hourCycle === "12h";
  const hour = parts ? (twelve ? String(to12(parts.h)) : pad2(parts.h)) : "--";
  const minute = parts ? pad2(parts.m) : "--";
  const second = parts ? pad2(parts.s) : "--";
  const meridiem = parts && twelve ? meridiemOf(parts.h) : "";
  const spoken = parts ? `${hour}:${minute}${meridiem ? ` ${meridiem}` : ""}` : "Loading time";
  const root = ["os-clock", `os-clock-${variant}`, `os-clock-${size}`, value === undefined && "os-clock-live"].filter(Boolean).join(" ");

  if (variant === "compact") {
    return (
      <span className={root} role="timer" aria-label={label ? `${label}, ${spoken}` : spoken}>
        <span className="os-clock-pulse" aria-hidden />
        <span className="os-clock-digits">
          {hour}:{minute}
          {meridiem && <span className="os-clock-meridiem"> {meridiem}</span>}
        </span>
        {label && <span className="os-clock-label">{label}</span>}
      </span>
    );
  }

  if (variant === "digital") {
    return (
      <div className={root} role="timer" aria-label={label ? `${label}, ${spoken}` : spoken}>
        <div className="os-clock-digits" aria-hidden>
          <span>{hour}</span>
          <span className="os-clock-colon">:</span>
          <span>{minute}</span>
          <span className="os-clock-tail">
            {meridiem && <span className="os-clock-meridiem">{meridiem}</span>}
            {showSeconds && <span className="os-clock-seconds">{second}</span>}
          </span>
        </div>
        {label && <span className="os-clock-label">{label}</span>}
      </div>
    );
  }

  return (
    <figure className={root} role="timer" aria-label={label ? `${label}, ${spoken}` : spoken}>
      {parts ? <Face parts={parts} variant={variant} showSeconds={showSeconds} /> : <span className="os-clock-face os-clock-face-empty" />}
      {label && (
        <figcaption className="os-clock-caption">
          <span className="os-clock-label">{label}</span>
          <span className="os-clock-small">{spoken}</span>
        </figcaption>
      )}
    </figure>
  );
}
