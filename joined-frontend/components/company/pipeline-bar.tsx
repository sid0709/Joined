import { Card, HStack, Stack, Text, type CardVariant } from "@joined/design-system";
import { PIPELINE_STAGES, pipelineTotal, type PipelineCounts } from "@/lib/company";

const BAR_HEIGHT = 8;
const SWATCH_SIZE = 8;
const PERCENT = 100;

/** Each stage gets its own tint, from cool (new) to warm (offer). */
const STAGE_TONE: Record<keyof PipelineCounts, CardVariant> = {
  new: "blue",
  screening: "purple",
  interview: "orange",
  offer: "green",
};

/** Where a job’s candidates sit: one stacked bar, then counts per stage. */
export function PipelineBar({
  pipeline,
  hasLegend = true,
}: {
  pipeline: PipelineCounts;
  hasLegend?: boolean;
}) {
  const total = pipelineTotal(pipeline);

  return (
    <Stack gap={2}>
      <HStack gap={0.5}>
        {total === 0 ? (
          <Card padding={0} height={BAR_HEIGHT} width="100%" variant="gray" />
        ) : (
          PIPELINE_STAGES.filter((stage) => pipeline[stage.key] > 0).map((stage) => (
            <Card
              key={stage.key}
              padding={0}
              height={BAR_HEIGHT}
              width={`${(pipeline[stage.key] / total) * PERCENT}%`}
              variant={STAGE_TONE[stage.key]}
            />
          ))
        )}
      </HStack>
      {hasLegend ? (
        <HStack gap={4} wrap="wrap">
          {PIPELINE_STAGES.map((stage) => (
            <HStack key={stage.key} gap={1.5} vAlign="center">
              <Card
                padding={0}
                width={SWATCH_SIZE}
                height={SWATCH_SIZE}
                variant={STAGE_TONE[stage.key]}
              />
              <Text type="supporting" weight="semibold" hasTabularNumbers>
                {pipeline[stage.key]}
              </Text>
              <Text type="supporting" color="secondary">
                {stage.label}
              </Text>
            </HStack>
          ))}
        </HStack>
      ) : null}
    </Stack>
  );
}
