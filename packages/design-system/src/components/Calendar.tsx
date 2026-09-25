"use client";

import { useState, type ReactNode } from "react";
import { Button, IconButton, SegmentedControl, SegmentedControlItem } from "./Action";
import { Icon } from "./Primitives";
import { CalendarAgenda } from "./CalendarAgenda";
import { CalendarMonth } from "./CalendarMonth";
import { CalendarSchedule } from "./CalendarSchedule";
import { Glyph, icons } from "./Glyph";
import type { ControlSize } from "./size";
import { VIEW_LABELS, type CalendarEvent, type CalendarView, type DateRange } from "./calendarTypes";
import {
  DAYS_PER_WEEK,
  DEFAULT_LOCALE,
  addDays,
  addMonths,
  monthNames,
  startOfDay,
  weekOf,
  type WeekStart,
} from "./date";
import { useControllable, useNow } from "./hooks";
import type { HourCycle } from "./time";

export type { CalendarEvent, CalendarView, CalendarTone, DateRange } from "./calendarTypes";

const NOW_TICK_MS = 60_000;
const DEFAULT_HOURS: [number, number] = [8, 19];

export interface CalendarProps {
  value?: Date | null;
  onChange?: (date: Date) => void;
  /** `range` picks a start, then an end, with a live preview between them. */
  selection?: "single" | "range";
  range?: DateRange | null;
  onRangeChange?: (range: DateRange) => void;
  view?: CalendarView;
  defaultView?: CalendarView;
  onViewChange?: (view: CalendarView) => void;
  /** Adds a view switcher when more than one is listed. */
  views?: CalendarView[];
  size?: ControlSize;
  events?: CalendarEvent[];
  /** Month cells show events as dots under the date or as titled chips. */
  eventDisplay?: "dots" | "chips";
  weekStartsOn?: WeekStart;
  min?: Date;
  max?: Date;
  isDateDisabled?: (date: Date) => boolean;
  /** First and last hour on the week and day grids. */
  hours?: [number, number];
  hourCycle?: HourCycle;
  showWeekNumbers?: boolean;
  /** Content under the grid — presets, a summary, actions. */
  footer?: ReactNode;
}

function MonthYearPicker({ cursor, onPick }: { cursor: Date; onPick: (date: Date) => void }) {
  const [year, setYear] = useState(cursor.getFullYear());
  return (
    <div className="os-cal-jump">
      <div className="os-cal-jump-year">
        <IconButton label="Previous year" variant="ghost" size="sm" icon={<Icon icon={icons.chevronLeft} />} onClick={() => setYear(year - 1)} />
        <span className="os-cal-jump-label">{year}</span>
        <IconButton label="Next year" variant="ghost" size="sm" icon={<Icon icon={icons.chevronRight} />} onClick={() => setYear(year + 1)} />
      </div>
      <div className="os-cal-jump-months">
        {monthNames("short").map((name, month) => (
          <button
            key={name}
            type="button"
            className="os-cal-jump-month"
            aria-pressed={year === cursor.getFullYear() && month === cursor.getMonth()}
            onClick={() => onPick(new Date(year, month, Math.min(cursor.getDate(), 28)))}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Month, week, day, or agenda — pick a date, a range, or just read the schedule. */
export function Calendar({
  value,
  onChange,
  selection = "single",
  range,
  onRangeChange,
  view: viewProp,
  defaultView = "month",
  onViewChange,
  views,
  size = "md",
  events = [],
  eventDisplay = "dots",
  weekStartsOn = 0,
  min,
  max,
  isDateDisabled,
  hours = DEFAULT_HOURS,
  hourCycle = "12h",
  showWeekNumbers,
  footer,
}: CalendarProps) {
  const [view, setView] = useControllable(viewProp, defaultView, onViewChange);
  const [cursor, setCursor] = useState(() => startOfDay(value ?? range?.start ?? new Date()));
  const [jumping, setJumping] = useState(false);
  const now = useNow(NOW_TICK_MS);
  const today = now ? startOfDay(now) : null;

  const days = view === "day" ? [cursor] : weekOf(cursor, weekStartsOn);
  const schedule = view === "week" || view === "day";

  function isDisabled(date: Date) {
    return Boolean((min && date < startOfDay(min)) || (max && date > startOfDay(max)) || isDateDisabled?.(date));
  }

  function pick(date: Date) {
    setCursor(date);
    if (selection === "range") {
      if (!range || range.end) onRangeChange?.({ start: date, end: null });
      else onRangeChange?.(date < range.start ? { start: date, end: range.start } : { start: range.start, end: date });
    } else {
      onChange?.(date);
    }
  }

  function shift(direction: 1 | -1) {
    if (view === "week") setCursor(addDays(cursor, direction * DAYS_PER_WEEK));
    else if (view === "day") setCursor(addDays(cursor, direction));
    else setCursor(addMonths(cursor, direction));
  }

  const unit = view === "week" ? "week" : view === "day" ? "day" : "month";
  const title =
    view === "week"
      ? `${days[0].toLocaleDateString(DEFAULT_LOCALE, { month: "short", day: "numeric" })} – ${days[days.length - 1].toLocaleDateString(DEFAULT_LOCALE, {
          month: days[0].getMonth() === days[days.length - 1].getMonth() ? undefined : "short",
          day: "numeric",
        })}`
      : view === "day"
        ? cursor.toLocaleDateString(DEFAULT_LOCALE, { weekday: "long", month: "long", day: "numeric" })
        : cursor.toLocaleDateString(DEFAULT_LOCALE, { month: "long" });

  return (
    <div
      className={["os-cal", `os-cal-${size}`, schedule && "os-cal-wide", view === "agenda" && "os-cal-agenda-view", eventDisplay === "chips" && "os-cal-wide"]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="os-cal-head">
        <button type="button" className="os-cal-title" aria-expanded={jumping} onClick={() => setJumping(!jumping)}>
          <span>{title}</span>
          {view !== "day" && <span className="os-cal-year">{cursor.getFullYear()}</span>}
          <Glyph name="chevronDown" className="os-cal-title-chevron" />
        </button>
        <div className="os-cal-actions">
          {views && views.length > 1 && (
            <SegmentedControl
              label="Calendar view"
              size="sm"
              value={view}
              onChange={(next) => {
                setJumping(false);
                setView(next as CalendarView);
              }}
            >
              {views.map((v) => (
                <SegmentedControlItem key={v} value={v} label={VIEW_LABELS[v]} />
              ))}
            </SegmentedControl>
          )}
          {size !== "sm" && today && (
            <Button label="Today" variant="secondary" size="sm" onClick={() => setCursor(today)} />
          )}
          <IconButton label={`Previous ${unit}`} variant="ghost" size="sm" icon={<Icon icon={icons.chevronLeft} />} onClick={() => shift(-1)} />
          <IconButton label={`Next ${unit}`} variant="ghost" size="sm" icon={<Icon icon={icons.chevronRight} />} onClick={() => shift(1)} />
        </div>
      </div>

      {jumping ? (
        <MonthYearPicker
          cursor={cursor}
          onPick={(date) => {
            setCursor(date);
            setJumping(false);
          }}
        />
      ) : view === "month" ? (
        <CalendarMonth
          cursor={cursor}
          onCursorChange={setCursor}
          value={value}
          range={selection === "range" ? range : null}
          onPick={pick}
          events={events}
          eventDisplay={eventDisplay}
          weekStartsOn={weekStartsOn}
          isDisabled={isDisabled}
          today={today}
          showWeekNumbers={showWeekNumbers}
        />
      ) : schedule ? (
        <CalendarSchedule days={days} events={events} value={value} onPick={pick} today={today} now={now} hours={hours} hourCycle={hourCycle} />
      ) : (
        <CalendarAgenda cursor={cursor} events={events} value={value} onPick={pick} today={today} hourCycle={hourCycle} />
      )}
      {footer && <div className="os-cal-footer">{footer}</div>}
    </div>
  );
}
