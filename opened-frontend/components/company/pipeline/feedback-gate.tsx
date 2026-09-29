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

const SKIP_SCORECARD_STAGE_IDS = new Set(["rejected"]);

/** Configure when stage moves need notes / rating / scorecard. */
export function FeedbackGateEditor({
  value,
  onChange,
  stages = [],
}: {
  value: FeedbackGateConfig;
  onChange: (next: FeedbackGateConfig) => void;
  /** Fixed + custom stage options for requireScorecardStages (not custom-only). */
  stages?: { id: string; title: string }[];
}) {
  const scorecardTargets = stages.filter((stage) => !SKIP_SCORECARD_STAGE_IDS.has(stage.id));

  const toggleScorecardStage = (stageId: string, enabled: boolean) => {
    const current = value.requireScorecardStages ?? [];
    const next = enabled
      ? current.includes(stageId)
        ? current
        : [...current, stageId]
      : current.filter((id) => id !== stageId);
    onChange({ ...value, requireScorecardStages: next });
  };

  return (
    <Stack gap={3}>
      <Text type="supporting" color="secondary">
        When enabled, the applicants board blocks advancing a candidate until the required feedback
        is present. Scorecard requirements can target any pipeline stage — fixed or custom — not
        only stages marked on the custom-stage editor.
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
      {scorecardTargets.length > 0 ? (
        <Stack gap={2}>
          <Text type="label">Require scorecard when advancing into</Text>
          <Text type="supporting" color="secondary">
            Applies to fixed stages and custom stages alike via requireScorecardStages.
          </Text>
          <Stack gap={2}>
            {scorecardTargets.map((stage) => (
              <CheckboxInput
                key={stage.id}
                label={stage.title}
                value={(value.requireScorecardStages ?? []).includes(stage.id)}
                onChange={(enabled) => toggleScorecardStage(stage.id, enabled)}
              />
            ))}
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}

/** Inline reason when a stage move is blocked. */
export function FeedbackGateBanner({ result }: { result: AdvanceCheckResult | null }) {
  if (!result || result.ok) return null;
  return <Banner status="warning" title="Feedback required" description={result.reason} />;
}
