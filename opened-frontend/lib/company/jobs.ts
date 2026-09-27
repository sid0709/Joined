import type { BadgeVariant } from "@openseat/design-system";
import { daysFromToday } from "@/lib/dates";
import type { Workplace } from "@/lib/jobs";

/** Hiring workspace — jobs. Sample data until the API lands. */

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

export const COMPANY_JOBS: CompanyJob[] = [
  {
    id: "cj-1",
    jobId: "product-designer-northwind",
    title: "Product Designer",
    team: "Design",
    location: "Chicago",
    workplace: "hybrid",
    status: "open",
    postedOn: daysFromToday(-12),
    views: 1_284,
    pipeline: { new: 7, screening: 5, interview: 3, offer: 1 },
    policy: "accept",
  },
  {
    id: "cj-2",
    jobId: "data-analyst-northwind",
    title: "Data Analyst",
    team: "Data",
    location: "New York",
    workplace: "hybrid",
    status: "open",
    postedOn: daysFromToday(-6),
    views: 642,
    pipeline: { new: 5, screening: 3, interview: 1, offer: 0 },
    policy: "cap",
    dailyCap: 5,
  },
  {
    id: "cj-3",
    title: "Senior UX Researcher",
    team: "Design",
    location: "Remote",
    workplace: "remote",
    status: "open",
    postedOn: daysFromToday(-2),
    views: 211,
    pipeline: { new: 4, screening: 0, interview: 0, offer: 0 },
    policy: "direct",
  },
  {
    id: "cj-4",
    title: "Support Lead",
    team: "Operations",
    location: "Remote",
    workplace: "remote",
    status: "paused",
    postedOn: daysFromToday(-30),
    views: 903,
    pipeline: { new: 0, screening: 2, interview: 2, offer: 0 },
    policy: "direct",
  },
  {
    id: "cj-5",
    title: "Design Systems Engineer",
    team: "Design",
    location: "Chicago",
    workplace: "hybrid",
    status: "draft",
    postedOn: daysFromToday(-1),
    views: 0,
    pipeline: { new: 0, screening: 0, interview: 0, offer: 0 },
    policy: "accept",
  },
  {
    id: "cj-6",
    title: "Office Coordinator",
    team: "Operations",
    location: "Chicago",
    workplace: "onsite",
    status: "closed",
    postedOn: daysFromToday(-64),
    views: 2_310,
    pipeline: { new: 0, screening: 0, interview: 0, offer: 1 },
    policy: "direct",
  },
];

export const pipelineTotal = (pipeline: PipelineCounts) =>
  pipeline.new + pipeline.screening + pipeline.interview + pipeline.offer;

export const jobTitle = (jobId: string) =>
  COMPANY_JOBS.find((job) => job.id === jobId)?.title ?? "—";
