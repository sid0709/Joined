import type { BadgeVariant, KanbanColumn } from "@openseat/design-system";

/** Hiring workspace — applicants to this company's jobs. */

export type ApplicantStage = "new" | "screening" | "interview" | "offer" | "hired" | "rejected";
/** Fixed six plus employer custom stage ids from the job pipeline. */
export type ApplicantColumnId = ApplicantStage | (string & {});
export type AssistedBy = "direct" | "bidder" | "agent";

export type Applicant = {
  id: string;
  /** KanbanBoard reads the stage as its column (fixed or custom). */
  columnId: ApplicantColumnId;
  name: string;
  headline: string;
  location: string;
  jobId: string;
  fit: number;
  verified: boolean;
  assisted: AssistedBy;
  resume: string;
  appliedOn: Date;
  experienceYears: number;
  lastCompany: string;
  skills: string[];
  /** Team score, 1–5, once someone has reviewed them. */
  rating?: number;
  notes?: string;
  jobTitle: string;
  /** Answers collected on apply (Einstein must return). */
  screeningAnswers?: import("@/lib/intake").ScreeningAnswer[];
  /** Employer pools / tags. */
  tags?: string[];
  referralSource?: string;
  /** ISO timestamp when the candidate consented on apply. */
  consentAt?: string;
  consentVersion?: string;
  /** Opaque seeker id when Einstein exposes it — preferred for dupe detection. */
  userId?: string;
  /** Team member ids assigned to interview this candidate (Layer C). */
  interviewerIds?: string[];
  /** Offer / hire record when Einstein returns it (Layer E). */
  offer?: import("@/lib/offer-hire").OfferRecord;
  /** ISO when columnId last changed — Einstein Layer G time-in-stage. */
  stageEnteredAt?: string;
  /** Prior stage visits for time-in-stage (Einstein). */
  stageHistory?: { stage: string; enteredAt: string }[];
};

export const APPLICANT_STAGES: { id: ApplicantStage; title: string; badge: BadgeVariant }[] = [
  { id: "new", title: "New", badge: "info" },
  { id: "screening", title: "Screening", badge: "purple" },
  { id: "interview", title: "Interview", badge: "warning" },
  { id: "offer", title: "Offer", badge: "success" },
  { id: "hired", title: "Hired", badge: "success" },
  { id: "rejected", title: "Rejected", badge: "neutral" },
];

export const APPLICANT_STAGE_BY_ID = Object.fromEntries(
  APPLICANT_STAGES.map((stage) => [stage.id, stage]),
) as Record<ApplicantStage, (typeof APPLICANT_STAGES)[number]>;

export const APPLICANT_COLUMNS: KanbanColumn[] = APPLICANT_STAGES.map((stage) => ({
  id: stage.id,
  title: stage.title,
}));

export const ASSISTED_LABEL: Record<AssistedBy, string> = {
  direct: "Applied directly",
  bidder: "Prepared by a bidder",
  agent: "Prepared by the agent",
};

export const STRONG_FIT = 85;
