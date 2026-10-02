import type { CalendarEvent } from "@joined/design-system";
import { startOfDay } from "@/lib/dates";
import { parseDay, toDayString } from "@/lib/me/dates";

/** What GET /v1/me/calendar/events says about the job hunter's Google Calendar. */
export type GoogleCalendarStatus = "connected" | "not_connected" | "reconnect" | "unavailable";

/** One event from the job hunter's own Google Calendar. Read-only in Joined. */
export type GoogleEvent = {
  id: string;
  title: string;
  /** "YYYY-MM-DD": the start day. */
  date: string;
  /** "YYYY-MM-DD": the last day an all-day event covers. */
  endDate?: string;
  /** "HH:mm" in the job hunter's zone; absent for all-day events. */
  start?: string;
  end?: string;
  allDay: boolean;
  location?: string;
  /** Opens the event in Google Calendar. */
  link?: string;
};

export type GoogleCalendarFeed = {
  status: GoogleCalendarStatus;
  email?: string;
  events: GoogleEvent[];
};

export const EMPTY_FEED: GoogleCalendarFeed = { status: "not_connected", events: [] };

/** Google events wear the neutral tone so Joined's interviews stand out. */
const GOOGLE_TONE = "neutral";
/** Ids are prefixed so a Google event never collides with an interview id. */
const ID_PREFIX = "google:";
/** Days fetched around the visible month, for the leading and trailing weeks. */
const MONTH_PADDING_DAYS = 7;
/** A runaway all-day event still shows on at most this many days. */
const MAX_SPAN_DAYS = 62;

/** The zone the browser runs in, e.g. "America/New_York". */
export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** The days to fetch for the month that contains `day`, with a week either side. */
export function monthWindow(day: Date) {
  const first = new Date(day.getFullYear(), day.getMonth(), 1 - MONTH_PADDING_DAYS);
  const last = new Date(day.getFullYear(), day.getMonth() + 1, MONTH_PADDING_DAYS);
  return { from: toDayString(first), to: toDayString(last) };
}

/** Each day an event covers: one for timed events, every day for all-day spans. */
function daysCovered(event: GoogleEvent) {
  const first = parseDay(event.date);
  if (!event.allDay || !event.endDate) return [first];
  const last = parseDay(event.endDate);
  const days: Date[] = [];
  for (
    let day = first;
    day <= last && days.length < MAX_SPAN_DAYS;
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  ) {
    days.push(day);
  }
  return days.length > 0 ? days : [first];
}

/** Google events as calendar chips beside the interviews. */
export function toGoogleCalendarEvents(events: GoogleEvent[]): CalendarEvent[] {
  return events.flatMap((event) =>
    daysCovered(event).map((day) => ({
      id: `${ID_PREFIX}${event.id}:${toDayString(day)}`,
      date: day,
      title: event.title,
      start: event.allDay ? undefined : event.start,
      end: event.allDay ? undefined : event.end,
      tone: GOOGLE_TONE,
      location: event.location,
    })),
  );
}

/** The Google events that fall on `day`, all-day ones first. */
export function googleEventsOn(events: GoogleEvent[], day: Date) {
  const target = startOfDay(day).getTime();
  return events.filter((event) =>
    daysCovered(event).some((covered) => covered.getTime() === target),
  );
}
