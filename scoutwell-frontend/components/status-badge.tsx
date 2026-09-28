import { Badge } from "@openseat/design-system";
import { CHECK_OUTCOME_META, EARNING_STATUS_META, SUBMISSION_STATUS_META } from "@/lib/status";
import type { CheckOutcome } from "@/lib/types";
import type { EarningStatus, SubmissionStatus } from "@/lib/types";

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  const meta = SUBMISSION_STATUS_META[status];
  return <Badge label={meta.label} variant={meta.badge} />;
}

export function EarningStatusBadge({ status }: { status: EarningStatus }) {
  const meta = EARNING_STATUS_META[status];
  return <Badge label={meta.label} variant={meta.badge} />;
}

export function CheckOutcomeBadge({ outcome }: { outcome: CheckOutcome }) {
  const meta = CHECK_OUTCOME_META[outcome];
  return <Badge label={meta.label} variant={meta.badge} />;
}
