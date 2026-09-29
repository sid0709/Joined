/** Hiring workspace — jobs the signed-in company has posted. */

import type { BadgeVariant } from "@openseat/design-system";
import type { Workplace } from "@/lib/jobs";

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
  status: CompanyJobStatus;
  postedOn: Date;
  views: number;
  pipeline: PipelineCounts;
  policy: AssistedPolicy;
  /** Assisted applications allowed per day when the policy is "cap". */
  dailyCap?: number;
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

export const PIPELINE_STAGES: { key: keyof PipelineCounts; label: string }[] = [
  { key: "new", label: "New" },
  { key: "screening", label: "Screening" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
];

export const pipelineTotal = (pipeline: PipelineCounts) =>
  pipeline.new + pipeline.screening + pipeline.interview + pipeline.offer;
