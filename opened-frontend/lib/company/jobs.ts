/** Hiring workspace — jobs the signed-in company has posted. */

import type { BadgeVariant } from "@openseat/design-system";
import type { Seniority, Workplace } from "@/lib/jobs";

export type CompanyJobStatus = "open" | "paused" | "draft" | "closed";
export type AssistedPolicy = "accept" | "cap" | "direct";

export type PipelineCounts = { new: number; screening: number; interview: number; offer: number };

export type CompanyJob = {
  id: string;
  /** The public posting, when there is one. */
  jobId?: string;
  title: string;
  team: string;
  location: string;
  workplace: Workplace;
  seniority: Seniority;
  status: CompanyJobStatus;
  postedOn: Date;
  views: number;
  pipeline: PipelineCounts;
  policy: AssistedPolicy;
  /** Assisted applications allowed per day when the policy is "cap". */
  dailyCap?: number;
  payMin: number;
  payMax: number;
  currency: string;
  visa: boolean;
  summary: string;
  skills: string[];
  responsibilities: string[];
  requirements: string[];
  description: string;
  /** Knockout / screening questions shown on apply. */
  screeningQuestions?: import("@/lib/intake").ScreeningQuestion[];
  /** Layer C — custom stages / eval config when Einstein returns them. */
  customStages?: import("@/lib/pipeline-eval").PipelineStageDef[];
  feedbackGate?: import("@/lib/pipeline-eval").FeedbackGateConfig;
  scorecardTemplate?: import("@/lib/pipeline-eval").ScorecardTemplate;
  interviewGuide?: import("@/lib/pipeline-eval").InterviewGuide;
};

export const JOB_STATUS_META: Record<CompanyJobStatus, { label: string; badge: BadgeVariant }> = {
  open: { label: "Open", badge: "success" },
  paused: { label: "Paused", badge: "warning" },
  draft: { label: "Draft", badge: "neutral" },
  closed: { label: "Closed", badge: "neutral" },
};

export const POLICY_META: Record<AssistedPolicy, { label: string; description: string }> = {
  accept: {
    label: "Accept assisted",
    description: "Take applications prepared by a bidder or the agent.",
  },
  cap: { label: "Cap per day", description: "Limit assisted applications to a daily number." },
  direct: { label: "Direct only", description: "Only people who apply themselves." },
};

export const ASSISTED_POLICIES = Object.keys(POLICY_META) as AssistedPolicy[];

/** Company and job default when a daily cap has not been set. */
export const DEFAULT_DAILY_CAP = 5;

/** Matches the hiring settings API, which stores caps from 1 through 100. */
export const MAX_DAILY_CAP = 100;

export const PIPELINE_STAGES: { key: keyof PipelineCounts; label: string }[] = [
  { key: "new", label: "New" },
  { key: "screening", label: "Screening" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
];

export const pipelineTotal = (pipeline: PipelineCounts) =>
  pipeline.new + pipeline.screening + pipeline.interview + pipeline.offer;
