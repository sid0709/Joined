"use client";

import { useState } from "react";

import { heatLevel } from "./chartMath";
import { ChartTip } from "./chartParts";

export type HeatmapDay = {
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string;
  value: number;
};

const LEVELS = 4;
const DAYS_IN_WEEK = 7;
const DAY_MS = 86_400_000;
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function parseDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function dayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Daily activity as weeks of cells, darker for busier days — one hue, light to dark.
 * Weeks run left to right, Sunday on top. Each cell reads out its date and count.
 */
export function HeatmapCalendar({
  days,
  label,
  unit = "events",
  locale,
}: {
  /** One entry per day with activity; missing days count as zero. */
  days: HeatmapDay[];
  /** Accessible name for the grid. */
  label: string;
  /** Plural noun read after each count, e.g. "applications". */
  unit?: string;
  locale?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  if (days.length === 0) return null;

  const values = new Map(days.map((day) => [day.date, day.value]));
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const first = parseDay(sorted[0].date);
  const last = parseDay(sorted[sorted.length - 1].date);
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - first.getDay());
  const total = Math.round((last.getTime() - start.getTime()) / DAY_MS) + 1;
  const weeks = Math.ceil(total / DAYS_IN_WEEK);
  const max = Math.max(0, ...days.map((day) => day.value));
  const month = new Intl.DateTimeFormat(locale, { month: "short" });
  const full = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const columns = Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: DAYS_IN_WEEK }, (_, weekday) => {
      const date = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + week * 7 + weekday,
      );
      const key = dayKey(date);
      const inRange = date >= first && date <= last;
      return { key, date, inRange, value: values.get(key) ?? 0 };
    }),
  );

  return (
    <div className="os-heatmap">
      <div
        className="os-heatmap-grid"
        style={{ gridTemplateColumns: `auto repeat(${weeks}, minmax(0, 1fr))` }}
      >
        <span />
        {columns.map((column, week) => {
          const opener = column.find((cell) => cell.date.getDate() <= DAYS_IN_WEEK && cell.inRange);
          return (
            <span key={`m-${week}`} className="os-heatmap-month">
              {opener && (week > 0 || opener.date.getDate() === 1)
                ? month.format(opener.date)
                : week === 0
                  ? month.format(first)
                  : ""}
            </span>
          );
        })}
        {WEEKDAY_LABELS.map((weekday, row) => (
          <HeatmapRow
            key={row}
            weekday={weekday}
            cells={columns.map((column) => column[row])}
            max={max}
            active={active}
            onActive={setActive}
            describe={(cell) => `${full.format(cell.date)}: ${cell.value} ${unit}`}
          />
        ))}
      </div>
      <div className="os-heatmap-scale" aria-hidden>
        <span>Less</span>
        {Array.from({ length: LEVELS + 1 }, (_, level) => (
          <span key={level} className="os-heatmap-cell" data-level={level} />
        ))}
        <span>More</span>
      </div>
      <span className="os-heatmap-label">{label}</span>
    </div>
  );
}

type Cell = { key: string; date: Date; inRange: boolean; value: number };

function HeatmapRow({
  weekday,
  cells,
  max,
  active,
  onActive,
  describe,
}: {
  weekday: string;
  cells: Cell[];
  max: number;
  active: string | null;
  onActive: (key: string | null) => void;
  describe: (cell: Cell) => string;
}) {
  return (
    <>
      <span className="os-heatmap-weekday">{weekday}</span>
      {cells.map((cell) =>
        cell.inRange ? (
          <span
            key={cell.key}
            className="os-heatmap-cell"
            data-level={heatLevel(cell.value, max, LEVELS)}
            tabIndex={0}
            role="img"
            aria-label={describe(cell)}
            onPointerEnter={() => onActive(cell.key)}
            onPointerLeave={() => onActive(null)}
            onFocus={() => onActive(cell.key)}
            onBlur={() => onActive(null)}
          >
            {active === cell.key ? (
              <ChartTip left="50%" top={0} rows={[{ label: "", value: describe(cell) }]} />
            ) : null}
          </span>
        ) : (
          <span key={cell.key} className="os-heatmap-cell" data-empty />
        ),
      )}
    </>
  );
}
