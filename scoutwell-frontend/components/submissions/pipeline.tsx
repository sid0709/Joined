import { SectionCard, SegmentBar } from "@openseat/design-system";
import type { Metrics } from "@openseat/scout";

/** Every job you sent, split by where it stands. Nothing renders until there is a first submission. */
export function SubmissionPipeline({ metrics }: { metrics: Metrics }) {
  const segments = [
    { label: "Approved", value: metrics.approved, tone: "green" as const },
    { label: "In review", value: metrics.pending, tone: "orange" as const },
    { label: "Rejected", value: metrics.rejected, tone: "red" as const },
    { label: "Duplicate", value: metrics.duplicate, tone: "neutral" as const },
  ];
  if (segments.every((segment) => segment.value === 0)) return null;

  return (
    <SectionCard title="Pipeline" description={`${metrics.submitted} jobs sent so far.`}>
      <SegmentBar segments={segments} unit="jobs" />
    </SectionCard>
  );
}
