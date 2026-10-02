import { Button, Glyph, HStack } from "@joined/design-system";
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
    <HStack className="acorn-action-bar" gap={2} data-phase={fillPhase}>
      <Button
        variant="secondary"
        icon={<Glyph name="sparkle" />}
        label={generateLabel}
        tooltip={generateTitle ?? generateLabel}
        isDisabled={generateDisabled}
        width="100%"
        onClick={onGenerate}
      />
      <Button
        variant="primary"
        icon={<Glyph name="edit" />}
        label={fillLabel}
        tooltip={fillTitle ?? fillLabel}
        isDisabled={fillDisabled}
        width="100%"
        onClick={onFill}
      />
      <Button
        variant="secondary"
        icon={<Glyph name="star" />}
        label={recommendLabel}
        tooltip={recommendTitle ?? recommendLabel}
        isDisabled={recommendDisabled}
        width="100%"
        onClick={onRecommend}
      />
    </HStack>
  );
}
