import type { BadgeVariant, CalendarEvent, CalendarTone } from "@joined/design-system";
import type { ProposedSlot, ScheduleMode } from "@/lib/schedule-join";

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
  /** Join URL, phone, or onsite address. Backend field `where`. */
  where?: string;
  /** Preferred video join URL when distinct from where. */
  meetingUrl?: string;
  /** Schedule mode returned by the company interviews API. */
  mode?: ScheduleMode;
  /** Candidate self-schedule link while status is awaiting. Token path, not the interview id. */
  selfScheduleUrl?: string;
  /** When the public link stops accepting a slot. Omitted when the link does not expire. */
  selfScheduleExpiresAt?: string;
  /** Slots offered while awaiting a pick. */
  proposedSlots?: ProposedSlot[];
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
