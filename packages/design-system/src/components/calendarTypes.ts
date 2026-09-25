export type CalendarView = "month" | "week" | "day" | "agenda";
export type CalendarTone = "accent" | "success" | "warning" | "danger" | "neutral";

export interface CalendarEvent {
  id: string;
  date: Date;
  title: string;
  /** "HH:mm". Events without a start are all-day. */
  start?: string;
  end?: string;
  tone?: CalendarTone;
  location?: string;
}

export interface DateRange {
  start: Date;
  /** null while the second date is still being picked. */
  end: Date | null;
}

export const VIEW_LABELS: Record<CalendarView, string> = {
  month: "Month",
  week: "Week",
  day: "Day",
  agenda: "Agenda",
};
