"use client";

import type { CSSProperties } from "react";
import type { CalendarEvent } from "./calendarTypes";
import { DEFAULT_LOCALE, sameDay } from "./date";
import { MINUTES_PER_HOUR, displayTime, minutesOf, range, type HourCycle } from "./time";

/** Shortest block drawn, so a 10-minute event still has room for its title. */
const MIN_EVENT_MINUTES = 30;
/** Below this, title and time share one line. */
const SHORT_EVENT_MINUTES = 50;

export interface CalendarScheduleProps {
  days: Date[];
  events: CalendarEvent[];
  value?: Date | null;
  onPick: (date: Date) => void;
  today: Date | null;
  now: Date | null;
  /** First and last hour shown, 0–24. */
  hours: [number, number];
  hourCycle: HourCycle;
}

interface Placed {
  event: CalendarEvent;
  start: number;
  end: number;
  column: number;
  columns: number;
}

/** Side-by-side columns for events that overlap, like any calendar app. */
function layout(events: CalendarEvent[]): Placed[] {
  const timed = events
    .filter((event) => event.start)
    .map((event) => {
      const start = minutesOf(event.start!);
      const end = Math.max(minutesOf(event.end ?? event.start!), start + MIN_EVENT_MINUTES);
      return { event, start, end, column: 0, columns: 1 };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const width = Math.max(1, ...cluster.map((p) => p.column + 1));
    cluster.forEach((p) => (p.columns = width));
    cluster = [];
  };
  for (const item of timed) {
    if (item.start >= clusterEnd) flush();
    const used = new Set(cluster.filter((p) => p.end > item.start).map((p) => p.column));
    let column = 0;
    while (used.has(column)) column++;
    item.column = column;
    cluster.push(item);
    placed.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return placed;
}

function hourLabel(hour: number, hourCycle: HourCycle) {
  return displayTime(`${String(hour).padStart(2, "0")}:00`, hourCycle).replace(":00", "");
}

/** A time grid for one day or a week, with overlap columns and a now line. */
export function CalendarSchedule({ days, events, value, onPick, today, now, hours, hourCycle }: CalendarScheduleProps) {
  const [first, last] = hours;
  const span = last - first;
  const nowMinutes = now ? now.getHours() * MINUTES_PER_HOUR + now.getMinutes() : null;
  const allDay = events.filter((event) => !event.start && days.some((day) => sameDay(day, event.date)));
  const style = { "--os-cal-days": days.length, "--os-cal-span": span } as CSSProperties;

  return (
    <div className={days.length === 1 ? "os-cal-schedule os-cal-schedule-day" : "os-cal-schedule"} style={style}>
      <div className="os-cal-sched-head">
        <span className="os-cal-gutter" />
        {days.map((day) => (
          <button
            key={day.toISOString()}
            type="button"
            className={[
              "os-cal-sched-day",
              sameDay(day, value) && "os-cal-sched-day-selected",
              sameDay(day, today) && "os-cal-sched-day-today",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={sameDay(day, value)}
            onClick={() => onPick(day)}
          >
            <span className="os-cal-sched-dow">{day.toLocaleDateString(DEFAULT_LOCALE, { weekday: "short" })}</span>
            <span className="os-cal-sched-num">{day.getDate()}</span>
          </button>
        ))}
      </div>

      {allDay.length > 0 && (
        <div className="os-cal-allday">
          <span className="os-cal-gutter os-cal-allday-label">All day</span>
          {days.map((day) => (
            <div key={day.toISOString()} className="os-cal-allday-cell">
              {allDay
                .filter((event) => sameDay(event.date, day))
                .map((event) => (
                  <span key={event.id} className={`os-cal-chip os-cal-tone-${event.tone ?? "accent"}`}>
                    {event.title}
                  </span>
                ))}
            </div>
          ))}
        </div>
      )}

      <div className="os-cal-sched-body">
        <div className="os-cal-gutter os-cal-hours" aria-hidden>
          {range(first, last - 1).map((hour) => (
            <span key={hour} className="os-cal-hour">
              {hour === first ? "" : hourLabel(hour, hourCycle)}
            </span>
          ))}
        </div>
        {days.map((day) => {
          const placed = layout(events.filter((event) => sameDay(event.date, day)));
          const showNow = sameDay(day, today) && nowMinutes != null && nowMinutes >= first * MINUTES_PER_HOUR && nowMinutes <= last * MINUTES_PER_HOUR;
          return (
            <div key={day.toISOString()} className={sameDay(day, today) ? "os-cal-lane os-cal-lane-today" : "os-cal-lane"}>
              {placed.map(({ event, start, end, column, columns }) => {
                const top = (start - first * MINUTES_PER_HOUR) / MINUTES_PER_HOUR;
                const height = (end - start) / MINUTES_PER_HOUR;
                if (top + height <= 0 || top >= span) return null;
                return (
                  <div
                    key={event.id}
                    className={[
                      "os-cal-event",
                      `os-cal-tone-${event.tone ?? "accent"}`,
                      end - start < SHORT_EVENT_MINUTES && "os-cal-event-short",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={
                      {
                        "--os-cal-top": Math.max(top, 0),
                        "--os-cal-height": Math.min(height, span - Math.max(top, 0)),
                        "--os-cal-col": column,
                        "--os-cal-cols": columns,
                      } as CSSProperties
                    }
                  >
                    <span className="os-cal-event-title">{event.title}</span>
                    <span className="os-cal-event-time">
                      {displayTime(event.start!, hourCycle)}
                      {event.end ? ` – ${displayTime(event.end, hourCycle)}` : ""}
                    </span>
                    {event.location && <span className="os-cal-event-time os-cal-event-loc">{event.location}</span>}
                  </div>
                );
              })}
              {showNow && (
                <span
                  className="os-cal-now"
                  style={{ "--os-cal-top": (nowMinutes! - first * MINUTES_PER_HOUR) / MINUTES_PER_HOUR } as CSSProperties}
                  aria-label="Now"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
