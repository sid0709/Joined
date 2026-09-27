import type { BadgeVariant, CalendarEvent, CalendarTone } from "@openseat/design-system";
import { daysFromToday } from "@/lib/dates";

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

export const INTERVIEWS: Interview[] = [
  {
    id: "int-1",
    applicationId: "app-1",
    company: "Northwind",
    role: "Product Designer",
    round: "Round 1 · Hiring manager",
    date: daysFromToday(3),
    start: "10:00",
    end: "10:45",
    format: "video",
    where: "meet.northwind.example/pd-round-1",
    interviewers: [
      { name: "Priya Shah", title: "Head of Design" },
      { name: "Marcus Lee", title: "Senior Product Manager" },
    ],
    status: "scheduled",
    source: "calendar",
    prep: DEFAULT_PREP("int-1").map((task, index) => ({ ...task, done: index < 2 })),
  },
  {
    id: "int-2",
    applicationId: "app-2",
    company: "Harbor",
    role: "Frontend Engineer",
    round: "Round 1 · Technical screen",
    date: daysFromToday(5),
    start: "14:30",
    end: "15:30",
    format: "video",
    where: "Link in the email invite",
    interviewers: [{ name: "Tomás Rivera", title: "Engineering Manager" }],
    status: "unconfirmed",
    source: "email",
    prep: DEFAULT_PREP("int-2"),
  },
  {
    id: "int-3",
    applicationId: "app-6",
    company: "Lumen Health",
    role: "Engineering Manager",
    round: "Offer call",
    date: daysFromToday(1),
    start: "16:00",
    end: "16:30",
    format: "phone",
    where: "+1 (312) 555-0142",
    interviewers: [{ name: "Grace Kim", title: "Recruiter" }],
    status: "scheduled",
    source: "manual",
    prep: [
      { id: "int-3-comp", label: "Decide on a counter for base salary", done: true },
      { id: "int-3-start", label: "Confirm a start date", done: false },
    ],
  },
  {
    id: "int-4",
    applicationId: "app-1",
    company: "Northwind",
    role: "Product Designer",
    round: "Round 2 · Portfolio review",
    date: daysFromToday(10),
    start: "13:00",
    end: "15:00",
    format: "onsite",
    where: "233 S Wacker Dr, Chicago",
    interviewers: [
      { name: "Priya Shah", title: "Head of Design" },
      { name: "Elena Novak", title: "Staff Designer" },
      { name: "Sam Patel", title: "Design Manager" },
    ],
    status: "scheduled",
    source: "calendar",
    prep: DEFAULT_PREP("int-4"),
  },
  {
    id: "int-5",
    applicationId: "app-1",
    company: "Northwind",
    role: "Product Designer",
    round: "Recruiter screen",
    date: daysFromToday(-3),
    start: "11:00",
    end: "11:30",
    format: "phone",
    where: "Phone",
    interviewers: [{ name: "Jess Moore", title: "Recruiter" }],
    status: "completed",
    source: "calendar",
    prep: [],
    outcome: "advanced",
    selfRating: 4,
    notes: "Asked about salary range and start date. Good energy.",
  },
  {
    id: "int-6",
    applicationId: "app-6",
    company: "Lumen Health",
    role: "Engineering Manager",
    round: "Final round",
    date: daysFromToday(-9),
    start: "09:30",
    end: "12:00",
    format: "onsite",
    where: "Lumen Health, Chicago",
    interviewers: [{ name: "Dev Raman", title: "VP Engineering" }],
    status: "completed",
    source: "manual",
    prep: [],
    outcome: "advanced",
    selfRating: 5,
    notes: "Strong systems conversation. They asked for references.",
  },
  {
    id: "int-7",
    applicationId: "app-8",
    company: "Fieldnote",
    role: "Content Designer",
    round: "Round 2 · Writing exercise",
    date: daysFromToday(-24),
    start: "15:00",
    end: "16:00",
    format: "video",
    where: "Video call",
    interviewers: [{ name: "Ana Torres", title: "Content Lead" }],
    status: "completed",
    source: "calendar",
    prep: [],
    outcome: "rejected",
    selfRating: 3,
    notes: "Ran short on time for the second prompt.",
  },
];

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
