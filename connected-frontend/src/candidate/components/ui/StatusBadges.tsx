import type {
  Assessment,
  EngagementStatus,
  Payout,
  Review,
  ReviewResolution,
} from "@/src/candidate/types/workspace";

import { Badge } from "@/src/shared/marketplace-ui";

type Tone = "neutral" | "info" | "success" | "warning" | "error" | "purple";

const ENGAGEMENT: Record<EngagementStatus, [string, Tone]> = {
  contacted: ["Waiting for reply", "info"],
  negotiating: ["Negotiating", "warning"],
  connected: ["Connected", "success"],
  declined: ["Declined", "neutral"],
  withdrawn: ["Withdrawn", "neutral"],
};
export const ENGAGEMENT_LABEL = (status: EngagementStatus) => ENGAGEMENT[status][0];
export const EngagementBadge = ({ status }: { status: EngagementStatus }) => (
  <Badge label={ENGAGEMENT[status][0]} tone={ENGAGEMENT[status][1]} />
);

const VERDICT: Record<Review["verdict"], [string, Tone]> = {
  approved: ["Approved", "success"],
  praise: ["Praise", "purple"],
  mistake: ["Mistake", "error"],
  warning: ["Heads-up", "warning"],
};
export const VerdictBadge = ({ verdict }: { verdict: Review["verdict"] }) => (
  <Badge label={VERDICT[verdict][0]} tone={VERDICT[verdict][1]} />
);

const RESOLUTION: Record<ReviewResolution, [string, Tone]> = {
  open: ["Needs your reply", "warning"],
  acknowledged: ["Acknowledged", "info"],
  fixed: ["Fixed · awaiting re-check", "info"],
  disputed: ["Disputed", "purple"],
  closed: ["Closed", "neutral"],
};
export const ResolutionBadge = ({ resolution }: { resolution: ReviewResolution }) => (
  <Badge label={RESOLUTION[resolution][0]} tone={RESOLUTION[resolution][1]} />
);

const PAYOUT: Record<Payout["status"], [string, Tone]> = {
  pending: ["Accruing", "neutral"],
  processing: ["Scheduled", "warning"],
  paid: ["Paid", "success"],
};
export const PayoutBadge = ({ status }: { status: Payout["status"] }) => (
  <Badge label={PAYOUT[status][0]} tone={PAYOUT[status][1]} />
);

const ASSESSMENT: Record<Assessment["status"], [string, Tone]> = {
  available: ["Not taken", "neutral"],
  passed: ["Passed", "success"],
  failed: ["Try again", "error"],
};
export const AssessmentBadge = ({ status }: { status: Assessment["status"] }) => (
  <Badge label={ASSESSMENT[status][0]} tone={ASSESSMENT[status][1]} />
);
