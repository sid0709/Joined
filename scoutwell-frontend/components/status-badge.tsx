import { Badge } from "@openseat/design-system";
import {
  CHECK_OUTCOME,
  EARNING_STATUS,
  PAYOUT_STATUS,
  SUBMISSION_STATUS,
  type CheckOutcome,
  type EarningStatus,
  type PayoutStatus,
  type Submission,
} from "@openseat/scout";

export function SubmissionStatusBadge({
  submission,
}: {
  submission: Pick<Submission, "status" | "expired">;
}) {
  if (submission.status === "approved" && submission.expired) {
    return <Badge label="Expired" variant="neutral" />;
  }
  const meta = SUBMISSION_STATUS[submission.status];
  return <Badge label={meta.label} variant={meta.badge} />;
}

export function EarningStatusBadge({ status }: { status: EarningStatus }) {
  const meta = EARNING_STATUS[status];
  return <Badge label={meta.label} variant={meta.badge} />;
}

export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  const meta = PAYOUT_STATUS[status];
  return <Badge label={meta.label} variant={meta.badge} />;
}

export function CheckOutcomeBadge({ outcome }: { outcome: CheckOutcome }) {
  const meta = CHECK_OUTCOME[outcome];
  return <Badge label={meta.label} variant={meta.badge} />;
}
