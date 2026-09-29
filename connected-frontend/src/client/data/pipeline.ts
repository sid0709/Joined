import type { HiringStage, InquiryStatus } from "@/src/client/types/hunter";

export interface StageDefinition {
  id: HiringStage;
  title: string;
  hint: string;
}

/** The hiring process a bidder moves through, left to right. */
export const HIRING_STAGES: StageDefinition[] = [
  { id: "inquiry", title: "Inquiry", hint: "A bidder contacted you about a task." },
  { id: "screening", title: "Screening", hint: "Review their profile, samples, and rate in chat." },
  { id: "interview", title: "Interview", hint: "A call is scheduled or has been held." },
  { id: "trial", title: "Trial batch", hint: "A small paid batch to check quality and pace." },
  { id: "connected", title: "Connected", hint: "Hired for this task. You can assign links." },
  { id: "declined", title: "Declined", hint: "Not moving forward." },
];

export const STAGE_TITLE = Object.fromEntries(
  HIRING_STAGES.map((stage) => [stage.id, stage.title]),
) as Record<HiringStage, string>;

/** Stage that matches the inquiry status used by chat and the task pages. */
export const STATUS_FOR_STAGE: Record<HiringStage, InquiryStatus> = {
  inquiry: "new",
  screening: "negotiating",
  interview: "negotiating",
  trial: "negotiating",
  connected: "connected",
  declined: "declined",
};

export const NEXT_STAGE: Partial<Record<HiringStage, HiringStage>> = {
  inquiry: "screening",
  screening: "interview",
  interview: "trial",
  trial: "connected",
};
