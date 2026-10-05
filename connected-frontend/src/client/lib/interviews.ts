import type {
  Interview,
  InterviewAvailability,
  InterviewMode,
} from "@/src/shared/types/marketplace";
import type { CalendarEvent, CalendarTone } from "sid-ui";

import { MOCK_TODAY, MOCK_WALL_TIME } from "@/src/shared/mock/clock";

const MINUTES_PER_HOUR = 60;
const SLOT_STEP_MIN = 30;

export const MODE_LABEL: Record<InterviewMode, string> = {
  video: "Video call",
  phone: "Phone call",
  chat: "Chat interview",
};
export const DURATIONS = [15, 30, 45, 60];

export const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
};

export const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, "0")}:${String(minutes % MINUTES_PER_HOUR).padStart(2, "0")}`;

export const endTime = (start: string, durationMin: number) =>
  toTime(toMinutes(start) + durationMin);

/** "9:30 AM" from "09:30". */
export function displayClock(time: string) {
  const minutes = toMinutes(time);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes % MINUTES_PER_HOUR).padStart(2, "0")} ${suffix}`;
}

/** A calendar day as a local Date, so the calendar draws it on the right cell. */
export const dateFromYmd = (ymd: string) => {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const ymdFromDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** A scheduled interview whose time has passed and still needs an outcome. */
export const needsOutcome = (interview: Interview) =>
  interview.status === "scheduled" &&
  (interview.date < MOCK_TODAY ||
    (interview.date === MOCK_TODAY &&
      toMinutes(interview.start) + interview.durationMin <= toMinutes(MOCK_WALL_TIME)));

export const isUpcoming = (interview: Interview) =>
  interview.status === "scheduled" && !needsOutcome(interview);

const TONE: Record<Interview["status"], CalendarTone> = {
  scheduled: "accent",
  completed: "success",
  cancelled: "neutral",
  no_show: "danger",
};

export function toEvent(interview: Interview, title: string): CalendarEvent {
  return {
    id: interview.id,
    date: dateFromYmd(interview.date),
    title,
    start: interview.start,
    end: endTime(interview.start, interview.durationMin),
    tone: needsOutcome(interview) ? "warning" : TONE[interview.status],
    location: MODE_LABEL[interview.mode],
  };
}

/** Open start times for a day: inside working hours, off working days, clear of other interviews and buffers. */
export function openSlots(
  date: string,
  durationMin: number,
  availability: InterviewAvailability,
  interviews: Interview[],
  ignoreId?: string,
): string[] {
  const day = dateFromYmd(date).getDay();
  if (!availability.days.includes(day)) return [];
  const booked = interviews.filter(
    (item) => item.id !== ignoreId && item.status === "scheduled" && item.date === date,
  );
  const slots: string[] = [];
  for (
    let start = availability.startHour * MINUTES_PER_HOUR;
    start + durationMin <= availability.endHour * MINUTES_PER_HOUR;
    start += SLOT_STEP_MIN
  ) {
    if (date === MOCK_TODAY && start <= toMinutes(MOCK_WALL_TIME)) continue;
    const clash = booked.some((item) => {
      const from = toMinutes(item.start) - availability.bufferMin;
      const to = toMinutes(item.start) + item.durationMin + availability.bufferMin;
      return start < to && start + durationMin > from;
    });
    if (!clash) slots.push(toTime(start));
  }
  return slots;
}
