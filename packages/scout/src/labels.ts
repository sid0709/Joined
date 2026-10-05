import {
  EMPLOYMENT_LABEL,
  SENIORITY_LABEL,
  WORKPLACE_LABEL,
  seniorityLabel,
} from "@joined/job-schema";

import type {
  Channel,
  CheckOutcome,
  EarningStatus,
  NotificationTone,
  PayoutStatus,
  RewardType,
  ScoutLevel,
  SubmissionChangeEvent,
  SubmissionStatus,
  Verification,
} from "./types";
import type { BadgeVariant, BannerStatus } from "@joined/design-system";

export { EMPLOYMENT_LABEL, SENIORITY_LABEL, WORKPLACE_LABEL, seniorityLabel };

type Meta = { label: string; badge: BadgeVariant };

/** How each submission status reads to scouts and moderators. */
export const SUBMISSION_STATUS: Record<SubmissionStatus, Meta & { description: string }> = {
  submitted: {
    label: "Submitted",
    badge: "neutral",
    description: "Queued for the automatic checks.",
  },
  auto_checking: {
    label: "Checking",
    badge: "info",
    description: "Opening the link and running quality checks.",
  },
  needs_review: {
    label: "In review",
    badge: "warning",
    description: "Passed the automatic checks; a moderator decides next.",
  },
  approved: {
    label: "Approved",
    badge: "success",
    description: "Published in the job pool.",
  },
  rejected: {
    label: "Rejected",
    badge: "error",
    description: "Did not meet the quality bar.",
  },
  duplicate: {
    label: "Duplicate",
    badge: "neutral",
    description: "Another submission already owns this job.",
  },
};

/** Statuses still moving through the pipeline; clients poll these. */
export const PENDING_STATUSES: readonly SubmissionStatus[] = ["submitted", "auto_checking"];

export function isPending(status: SubmissionStatus) {
  return PENDING_STATUSES.includes(status);
}

export const CHECK_OUTCOME: Record<CheckOutcome, Meta> = {
  pass: { label: "Pass", badge: "success" },
  fail: { label: "Fail", badge: "error" },
  review: { label: "Review", badge: "warning" },
  flag: { label: "Flag", badge: "info" },
};

export const EARNING_STATUS: Record<EarningStatus, Meta> = {
  held: { label: "Held", badge: "warning" },
  released: { label: "Available", badge: "info" },
  processing: { label: "Paying out", badge: "blue" },
  paid: { label: "Paid", badge: "success" },
  clawed_back: { label: "Clawed back", badge: "error" },
};

export const PAYOUT_STATUS: Record<PayoutStatus, Meta> = {
  requested: { label: "Requested", badge: "warning" },
  approved: { label: "Approved", badge: "info" },
  sent: { label: "Sending", badge: "blue" },
  paid: { label: "Paid", badge: "success" },
  failed: { label: "Failed", badge: "error" },
  rejected: { label: "Declined", badge: "error" },
};

export const REWARD_TYPE: Record<RewardType, { label: string; detail: string }> = {
  approval: { label: "Approval", detail: "Your job was published after quality checks." },
  apply: { label: "Application", detail: "A candidate applied to your job." },
  interview: { label: "Interview", detail: "An interview on your job settled." },
  hire: { label: "Hire", detail: "A hire on your job was confirmed." },
  conversion: { label: "Company conversion", detail: "Share of a claimed company's fees." },
};

export const LEVEL_BADGE: Record<ScoutLevel, BadgeVariant> = {
  probation: "neutral",
  trusted: "blue",
  expert: "purple",
};

export const VERIFICATION: Record<Verification, Meta> = {
  none: { label: "Not verified", badge: "neutral" },
  pending: { label: "Verification pending", badge: "warning" },
  verified: { label: "Verified", badge: "success" },
  rejected: { label: "Verification declined", badge: "error" },
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  web: "Web",
  api: "API",
};

export const TONE_BANNER: Record<NotificationTone, BannerStatus> = {
  accent: "info",
  success: "success",
  warning: "warning",
  danger: "error",
  neutral: "info",
};

export const TONE_BADGE: Record<NotificationTone, BadgeVariant> = {
  accent: "blue",
  success: "success",
  warning: "warning",
  danger: "error",
  neutral: "neutral",
};

/** Status changes the extension polls: GET /v1/scout/notifications?since= */
export const SUBMISSION_CHANGE: Record<SubmissionChangeEvent, Meta> = {
  accepted: { label: "Accepted", badge: "success" },
  rejected: { label: "Rejected", badge: "error" },
  published: { label: "Published", badge: "info" },
  earned: { label: "Earned", badge: "success" },
};

/** Options for selectors, in the order the API lists them. */
export function options<T extends string>(values: readonly T[], labels: Record<T, string>) {
  return values.map((value) => ({ value, label: labels[value] }));
}
