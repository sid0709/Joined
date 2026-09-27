import type { BadgeVariant, CalendarEvent, CalendarTone } from "@openseat/design-system";
import { daysFromToday } from "@/lib/dates";
import { jobTitle } from "./jobs";

/** Hiring workspace — interviews. Sample data until the API lands. */

export type CompanyInterviewStatus = "scheduled" | "awaiting" | "attended" | "no-show";
export type FaceCheck = "passed" | "pending" | "failed";

export type CompanyInterview = {
  id: string;
  applicantId: string;
  candidate: string;
  jobId: string;
  round: string;
  date: Date;
  start: string;
  end: string;
  format: "video" | "onsite" | "phone";
  interviewers: string[];
  status: CompanyInterviewStatus;
  faceCheck: FaceCheck;
};

export const INTERVIEW_STATUS_META: Record<
  CompanyInterviewStatus,
  { label: string; badge: BadgeVariant; tone: CalendarTone }
> = {
  scheduled: { label: "Scheduled", badge: "info", tone: "accent" },
  awaiting: { label: "Awaiting a slot", badge: "warning", tone: "warning" },
  attended: { label: "Attended", badge: "success", tone: "success" },
  "no-show": { label: "No-show", badge: "error", tone: "danger" },
};

export const FACE_CHECK_META: Record<FaceCheck, { label: string; badge: BadgeVariant }> = {
  passed: { label: "Face check passed", badge: "success" },
  pending: { label: "Face check at join", badge: "neutral" },
  failed: { label: "Face check failed", badge: "error" },
};

export const COMPANY_INTERVIEWS: CompanyInterview[] = [
  {
    id: "ci-1",
    applicantId: "a-1",
    candidate: "Alex Rivera",
    jobId: "cj-1",
    round: "Round 1 · Hiring manager",
    date: daysFromToday(0),
    start: "15:00",
    end: "15:45",
    format: "video",
    interviewers: ["Jordan Avery", "Priya Shah"],
    status: "scheduled",
    faceCheck: "pending",
  },
  {
    id: "ci-2",
    applicantId: "a-5",
    candidate: "Riley Chen",
    jobId: "cj-2",
    round: "Round 2 · SQL exercise",
    date: daysFromToday(1),
    start: "11:00",
    end: "12:00",
    format: "video",
    interviewers: ["Marcus Lee"],
    status: "scheduled",
    faceCheck: "pending",
  },
  {
    id: "ci-3",
    applicantId: "a-2",
    candidate: "Dana Kim",
    jobId: "cj-1",
    round: "Round 1 · Hiring manager",
    date: daysFromToday(3),
    start: "10:00",
    end: "10:45",
    format: "video",
    interviewers: ["Jordan Avery"],
    status: "awaiting",
    faceCheck: "pending",
  },
  {
    id: "ci-4",
    applicantId: "a-7",
    candidate: "Jamie Ortiz",
    jobId: "cj-1",
    round: "Final · Portfolio review",
    date: daysFromToday(-4),
    start: "13:00",
    end: "15:00",
    format: "onsite",
    interviewers: ["Priya Shah", "Elena Novak", "Sam Patel"],
    status: "attended",
    faceCheck: "passed",
  },
  {
    id: "ci-5",
    applicantId: "a-5",
    candidate: "Riley Chen",
    jobId: "cj-2",
    round: "Round 1 · Recruiter screen",
    date: daysFromToday(-6),
    start: "09:30",
    end: "10:00",
    format: "phone",
    interviewers: ["Grace Kim"],
    status: "attended",
    faceCheck: "passed",
  },
  {
    id: "ci-6",
    applicantId: "a-9",
    candidate: "Sam Okafor",
    jobId: "cj-4",
    round: "Round 1 · Hiring manager",
    date: daysFromToday(-10),
    start: "14:00",
    end: "14:30",
    format: "video",
    interviewers: ["Dev Raman"],
    status: "no-show",
    faceCheck: "failed",
  },
];

export function toCompanyCalendarEvent(interview: CompanyInterview): CalendarEvent {
  return {
    id: interview.id,
    date: interview.date,
    title: interview.candidate,
    start: interview.start,
    end: interview.end,
    tone: INTERVIEW_STATUS_META[interview.status].tone,
    location: jobTitle(interview.jobId),
  };
}
