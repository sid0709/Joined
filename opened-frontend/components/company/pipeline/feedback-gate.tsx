"use client";

import { Banner, CheckboxInput, Stack, Text } from "@openseat/design-system";
import {
  canAdvanceStage,
  type AdvanceCheckInput,
  type AdvanceCheckResult,
  type FeedbackGateConfig,
} from "@/lib/pipeline-eval";

export { canAdvanceStage };
export type { AdvanceCheckInput, AdvanceCheckResult, FeedbackGateConfig };

/** Configure when stage moves need notes / rating / scorecard. Local until Einstein persists. */
export function FeedbackGateEditor({
  value,
  onChange,
}: {
  value: FeedbackGateConfig;
  onChange: (next: FeedbackGateConfig) => void;
}) {
  return (
    <Stack gap={3}>
      <Text type="supporting" color="secondary">
        When enabled, the applicants board blocks advancing a candidate until the required feedback
        is present.
      </Text>
      <CheckboxInput
        label="Require notes before advancing"
        value={value.requireNotesOnAdvance}
        onChange={(requireNotesOnAdvance) => onChange({ ...value, requireNotesOnAdvance })}
      />
      <CheckboxInput
        label="Require rating before advancing"
        value={value.requireRatingOnAdvance}
        onChange={(requireRatingOnAdvance) => onChange({ ...value, requireRatingOnAdvance })}
      />
      {/* TODO(einstein): PUT /v1/company/jobs/:id/pipeline { feedbackGate } */}
    </Stack>
  );
}

/** Inline reason when a stage move is blocked. */
export function FeedbackGateBanner({ result }: { result: AdvanceCheckResult | null }) {
  if (!result || result.ok) return null;
  return <Banner status="warning" title="Feedback required" description={result.reason} />;
}
