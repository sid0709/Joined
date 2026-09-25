"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { CalendarEvent, DateRange } from "./calendarTypes";
import {
  DAYS_PER_WEEK,
  DEFAULT_LOCALE,
  MS_PER_DAY,
  addDays,
  addMonths,
  isBetween,
  monthGrid,
  sameDay,
  sameMonth,
  startOfWeek,
  weekdayNames,
  type WeekStart,
} from "./date";

const MAX_CHIPS = 2;
const MAX_DOTS = 3;

export interface CalendarMonthProps {
  cursor: Date;
  onCursorChange: (date: Date) => void;
  value?: Date | null;
  range?: DateRange | null;
  onPick: (date: Date) => void;
  events: CalendarEvent[];
  eventDisplay: "dots" | "chips";
  weekStartsOn: WeekStart;
  isDisabled: (date: Date) => boolean;
  today: Date | null;
  showWeekNumbers?: boolean;
}

function isoWeek(date: Date) {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 4 - (date.getDay() || DAYS_PER_WEEK));
  const yearStart = new Date(target.getFullYear(), 0, 1);
  return Math.ceil(((target.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / DAYS_PER_WEEK);
}

/** Six fixed weeks. Arrow keys walk days, PageUp/PageDown walk months. */
export function CalendarMonth({
  cursor,
  onCursorChange,
  value,
  range,
  onPick,
  events,
  eventDisplay,
  weekStartsOn,
  isDisabled,
  today,
  showWeekNumbers,
}: CalendarMonthProps) {
  const cells = monthGrid(cursor, weekStartsOn);
  const [hover, setHover] = useState<Date | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const wantsFocus = useRef(false);
  const rangeEnd = range?.end ?? (range && hover ? hover : null);

  useEffect(() => {
    if (!wantsFocus.current) return;
    wantsFocus.current = false;
    gridRef.current?.querySelector<HTMLElement>("[tabindex='0']")?.focus();
  }, [cursor]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -DAYS_PER_WEEK),
      ArrowDown: () => addDays(cursor, DAYS_PER_WEEK),
      PageUp: () => addMonths(cursor, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(cursor, event.shiftKey ? 12 : 1),
      Home: () => startOfWeek(cursor, weekStartsOn),
      End: () => addDays(startOfWeek(cursor, weekStartsOn), DAYS_PER_WEEK - 1),
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      wantsFocus.current = true;
      onCursorChange(move());
    } else if ((event.key === "Enter" || event.key === " ") && !isDisabled(cursor)) {
      event.preventDefault();
      onPick(cursor);
    }
  }

  return (
    <div
      ref={gridRef}
      className={["os-cal-month", eventDisplay === "chips" && "os-cal-month-chips", showWeekNumbers && "os-cal-month-weeks"].filter(Boolean).join(" ")}
      role="grid"
      aria-label={cursor.toLocaleDateString(DEFAULT_LOCALE, { month: "long", year: "numeric" })}
      onKeyDown={onKeyDown}
      onPointerLeave={() => setHover(null)}
    >
      <div className="os-cal-row os-cal-dows" role="row">
        {showWeekNumbers && <span className="os-cal-weekno" role="columnheader" aria-label="Week" />}
        {weekdayNames(weekStartsOn, "short").map((name) => (
          <span key={name} className="os-cal-dow" role="columnheader" aria-label={name}>
            {eventDisplay === "chips" ? name : name.slice(0, 2)}
          </span>
        ))}
      </div>
      {Array.from({ length: cells.length / DAYS_PER_WEEK }, (_, week) => (
        <div key={week} className="os-cal-row" role="row">
          {showWeekNumbers && (
            <span className="os-cal-weekno" role="rowheader">
              {isoWeek(cells[week * DAYS_PER_WEEK])}
            </span>
          )}
          {cells.slice(week * DAYS_PER_WEEK, week * DAYS_PER_WEEK + DAYS_PER_WEEK).map((day) => {
            const dayEvents = events.filter((event) => sameDay(event.date, day));
            const outside = !sameMonth(day, cursor);
            const disabled = isDisabled(day);
            const isStart = sameDay(range?.start, day);
            const isEnd = sameDay(rangeEnd, day);
            const inRange = Boolean(range?.start && rangeEnd && isBetween(day, range.start, rangeEnd));
            const selected = sameDay(value, day) || isStart || isEnd;
            const reversed = Boolean(range?.start && rangeEnd && rangeEnd < range.start);
            return (
              <div
                key={day.toISOString()}
                role="gridcell"
                aria-selected={selected}
                className={[
                  "os-cal-cell",
                  inRange && "os-cal-in-range",
                  range?.start && rangeEnd && !sameDay(range.start, rangeEnd) && (reversed ? isEnd : isStart) && "os-cal-range-start",
                  range?.start && rangeEnd && !sameDay(range.start, rangeEnd) && (reversed ? isStart : isEnd) && "os-cal-range-end",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <button
                  type="button"
                  tabIndex={sameDay(day, cursor) ? 0 : -1}
                  disabled={disabled}
                  aria-label={day.toLocaleDateString(DEFAULT_LOCALE, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  aria-current={sameDay(day, today) ? "date" : undefined}
                  className={[
                    "os-cal-day",
                    outside && "os-cal-day-outside",
                    selected && "os-cal-day-selected",
                    sameDay(day, today) && "os-cal-day-today",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    onCursorChange(day);
                    onPick(day);
                  }}
                  onPointerEnter={() => range?.start && !range.end && setHover(day)}
                >
                  <span className="os-cal-num">{day.getDate()}</span>
                  {eventDisplay === "dots" && dayEvents.length > 0 && (
                    <span className="os-cal-dots" aria-hidden>
                      {dayEvents.slice(0, MAX_DOTS).map((event) => (
                        <span key={event.id} className={`os-cal-dot os-cal-tone-${event.tone ?? "accent"}`} />
                      ))}
                    </span>
                  )}
                </button>
                {eventDisplay === "chips" && dayEvents.length > 0 && (
                  <div className="os-cal-chips">
                    {dayEvents.slice(0, MAX_CHIPS).map((event) => (
                      <span key={event.id} className={`os-cal-chip os-cal-tone-${event.tone ?? "accent"}`} title={event.title}>
                        {event.start && <span className="os-cal-chip-time">{event.start}</span>}
                        {event.title}
                      </span>
                    ))}
                    {dayEvents.length > MAX_CHIPS && <span className="os-cal-more">+{dayEvents.length - MAX_CHIPS} more</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
