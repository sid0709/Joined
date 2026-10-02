import { Button, Glyph, HStack, VStack } from "@joined/design-system";
import type { PipelineProgress } from "@acorn/shared/pipeline-types";

type SidebarActionBarProps = {
  fillPhase: PipelineProgress["phase"];
  fillLabel: string;
  generateLabel: string;
  recommendLabel: string;
  fillDisabled: boolean;
  generateDisabled: boolean;
  recommendDisabled: boolean;
  fillTitle?: string;
  generateTitle?: string;
  recommendTitle?: string;
  onFill: () => void;
  onGenerate: () => void;
  onRecommend: () => void;
};

export function SidebarActionBar({
  fillPhase,
  fillLabel,
  generateLabel,
  recommendLabel,
  fillDisabled,
  generateDisabled,
  recommendDisabled,
  fillTitle,
  generateTitle,
  recommendTitle,
  onFill,
  onGenerate,
  onRecommend,
}: SidebarActionBarProps) {
  return (
    <VStack className="acorn-action-bar" gap={2} data-phase={fillPhase}>
      <Button
        variant="primary"
        icon={<Glyph name="edit" />}
        label={fillLabel}
        tooltip={fillTitle ?? fillLabel}
        isDisabled={fillDisabled}
        width="100%"
        onClick={onFill}
      />
      <HStack gap={2} className="acorn-action-bar-row">
        <Button
          variant="secondary"
          icon={<Glyph name="sparkle" />}
          label={generateLabel}
          tooltip={generateTitle ?? generateLabel}
          isDisabled={generateDisabled}
          onClick={onGenerate}
        />
        <Button
          variant="secondary"
          icon={<Glyph name="star" />}
          label={recommendLabel}
          tooltip={recommendTitle ?? recommendLabel}
          isDisabled={recommendDisabled}
          onClick={onRecommend}
        />
      </HStack>
    </VStack>
  );
}
