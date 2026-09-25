"use client";

import type { CalendarEvent } from "./calendarTypes";
import { DEFAULT_LOCALE, sameDay, sameMonth, startOfDay } from "./date";
import { displayTime, minutesOf, type HourCycle } from "./time";

export interface CalendarAgendaProps {
  cursor: Date;
  events: CalendarEvent[];
  value?: Date | null;
  onPick: (date: Date) => void;
  today: Date | null;
  hourCycle: HourCycle;
}

/** The month's events as a reading list, grouped by day. */
export function CalendarAgenda({ cursor, events, value, onPick, today, hourCycle }: CalendarAgendaProps) {
  const inMonth = events
    .filter((event) => sameMonth(event.date, cursor))
    .sort((a, b) => a.date.getTime() - b.date.getTime() || minutesOf(a.start ?? "00:00") - minutesOf(b.start ?? "00:00"));
  const days = inMonth.reduce<Date[]>((out, event) => {
    if (!out.some((day) => sameDay(day, event.date))) out.push(startOfDay(event.date));
    return out;
  }, []);

  if (days.length === 0) return <p className="os-cal-agenda-empty">Nothing scheduled this month.</p>;

  return (
    <div className="os-cal-agenda">
      {days.map((day) => (
        <section key={day.toISOString()} className="os-cal-agenda-day">
          <button
            type="button"
            className={[
              "os-cal-agenda-date",
              sameDay(day, today) && "os-cal-agenda-today",
              sameDay(day, value) && "os-cal-agenda-selected",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onPick(day)}
          >
            <span className="os-cal-agenda-num">{day.getDate()}</span>
            <span className="os-cal-agenda-dow">{day.toLocaleDateString(DEFAULT_LOCALE, { weekday: "short" })}</span>
          </button>
          <ul className="os-cal-agenda-list">
            {inMonth
              .filter((event) => sameDay(event.date, day))
              .map((event) => (
                <li key={event.id} className={`os-cal-agenda-item os-cal-tone-${event.tone ?? "accent"}`}>
                  <span className="os-cal-agenda-bar" aria-hidden />
                  <span className="os-cal-agenda-time">
                    {event.start ? displayTime(event.start, hourCycle) : "All day"}
                    {event.end && <span className="os-cal-agenda-end">{displayTime(event.end, hourCycle)}</span>}
                  </span>
                  <span className="os-cal-agenda-copy">
                    <span className="os-cal-agenda-title">{event.title}</span>
                    {event.location && <span className="os-cal-agenda-loc">{event.location}</span>}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
