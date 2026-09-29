import type { BadgeVariant, CalendarEvent, CalendarTone } from "@openseat/design-system";

/** Hiring workspace — interviews this company scheduled. */

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
  jobTitle: string;
  chargedCents: number;
  where?: string;
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

export function toCompanyCalendarEvent(interview: CompanyInterview): CalendarEvent {
  return {
    id: interview.id,
    date: interview.date,
    title: interview.candidate,
    start: interview.start,
    end: interview.end,
    tone: INTERVIEW_STATUS_META[interview.status].tone,
    location: interview.jobTitle,
  };
}
