import type { BadgeVariant, CalendarEvent, CalendarTone } from "@joined/design-system";
import { parseDay } from "@/lib/me/dates";

export type InterviewFormat = "video" | "phone" | "onsite";
export type InterviewStatus = "scheduled" | "unconfirmed" | "completed" | "cancelled";
export type InterviewOutcome = "advanced" | "rejected" | "waiting";
export type InterviewSource = "calendar" | "email" | "manual";

export type Interviewer = { name: string; title: string };
export type PrepTask = { id: string; label: string; done: boolean };

export type Interview = {
  id: string;
  applicationId: string;
  company: string;
  role: string;
  round: string;
  date: Date;
  /** "HH:mm", local time. */
  start: string;
  end: string;
  format: InterviewFormat;
  /** A meeting link, phone number, or street address. */
  where: string;
  interviewers: Interviewer[];
  status: InterviewStatus;
  source: InterviewSource;
  prep: PrepTask[];
  outcome?: InterviewOutcome;
  /** Your own read on how it went, 1–5. */
  selfRating?: number;
  notes?: string;
};

export const FORMAT_LABEL: Record<InterviewFormat, string> = {
  video: "Video call",
  phone: "Phone",
  onsite: "On-site",
};

export const SOURCE_LABEL: Record<InterviewSource, string> = {
  calendar: "From calendar",
  email: "Detected in email",
  manual: "Added by you",
};

export const STATUS_META: Record<
  InterviewStatus,
  { label: string; badge: BadgeVariant; tone: CalendarTone }
> = {
  scheduled: { label: "Scheduled", badge: "info", tone: "accent" },
  unconfirmed: { label: "Needs confirming", badge: "warning", tone: "warning" },
  completed: { label: "Completed", badge: "neutral", tone: "neutral" },
  cancelled: { label: "Cancelled", badge: "error", tone: "danger" },
};

export const OUTCOME_META: Record<InterviewOutcome, { label: string; badge: BadgeVariant }> = {
  advanced: { label: "Advanced", badge: "success" },
  rejected: { label: "Not moving forward", badge: "error" },
  waiting: { label: "Waiting to hear", badge: "neutral" },
};

const DEFAULT_PREP = (id: string): PrepTask[] => [
  { id: `${id}-research`, label: "Research the company and product", done: false },
  { id: `${id}-stories`, label: "Prepare three impact stories", done: false },
  { id: `${id}-questions`, label: "Write questions for them", done: false },
  { id: `${id}-setup`, label: "Test camera, mic, and link", done: false },
];

export function defaultPrep(id: string) {
  return DEFAULT_PREP(id);
}

export function hydrateInterview(raw: Interview): Interview {
  return {
    ...raw,
    date: parseDay(raw.date),
    interviewers: raw.interviewers ?? [],
    prep: raw.prep ?? [],
  };
}

export const isUpcoming = (interview: Interview) =>
  interview.status === "scheduled" || interview.status === "unconfirmed";

export function byDateTime(a: Interview, b: Interview) {
  return a.date.getTime() - b.date.getTime() || a.start.localeCompare(b.start);
}

export function toCalendarEvent(interview: Interview): CalendarEvent {
  return {
    id: interview.id,
    date: interview.date,
    title: `${interview.company} · ${interview.round.split(" · ")[0]}`,
    start: interview.start,
    end: interview.end,
    tone: STATUS_META[interview.status].tone,
    location: FORMAT_LABEL[interview.format],
  };
}
