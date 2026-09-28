import type { BadgeVariant } from "@openseat/design-system";
import type { EarningStatus, RewardType, SubmissionStatus } from "./types";

export const SUBMISSION_STATUS_META: Record<
  SubmissionStatus,
  { label: string; badge: BadgeVariant }
> = {
  submitted: { label: "Submitted", badge: "neutral" },
  auto_checking: { label: "Checking", badge: "info" },
  needs_review: { label: "Needs review", badge: "warning" },
  approved: { label: "Approved", badge: "success" },
  rejected: { label: "Rejected", badge: "error" },
  duplicate: { label: "Duplicate", badge: "neutral" },
};

export const EARNING_STATUS_META: Record<EarningStatus, { label: string; badge: BadgeVariant }> = {
  held: { label: "Held", badge: "warning" },
  released: { label: "Released", badge: "info" },
  paid: { label: "Paid", badge: "success" },
  clawed_back: { label: "Clawed back", badge: "error" },
};

export const REWARD_TYPE_META: Record<RewardType, { label: string; detail: string }> = {
  approval: { label: "Approval", detail: "Job published after quality checks" },
  interview: { label: "Interview", detail: "Settled interview on your job" },
  hire: { label: "Hire", detail: "Confirmed hire on your job" },
  conversion: { label: "Company conversion", detail: "Share of that company's paid interviews" },
};

export const CHECK_OUTCOME_META: Record<string, { label: string; badge: BadgeVariant }> = {
  pass: { label: "Pass", badge: "success" },
  fail: { label: "Fail", badge: "error" },
  flag: { label: "Flag", badge: "warning" },
  review: { label: "Review", badge: "warning" },
};
