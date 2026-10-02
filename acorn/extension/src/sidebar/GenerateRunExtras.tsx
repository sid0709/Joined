import { Button, HStack, VStack } from "@joined/design-system";
import type { CustomUiProgress } from "../pipeline/custom-generate-progress";
import { GenerateProgressBar } from "./GenerateProgressBar";

type GenerateRunExtrasProps = {
  progress: CustomUiProgress | null;
  showBar: boolean;
  canContinue: boolean;
  canRestart: boolean;
  canViewJd: boolean;
  onContinue?: () => void;
  onRestart?: () => void;
  onViewJd?: () => void;
};

export function GenerateRunExtras({
  progress,
  showBar,
  canContinue,
  canRestart,
  canViewJd,
  onContinue,
  onRestart,
  onViewJd,
}: GenerateRunExtrasProps) {
  if (!showBar && !canContinue && !canViewJd && !canRestart) return null;
  return (
    <VStack gap={2} className="acorn-gen-extras">
      {showBar && progress ? <GenerateProgressBar progress={progress} /> : null}
      {canContinue || canViewJd || canRestart ? (
        <HStack gap={1} wrap="wrap">
          {canContinue ? (
            <Button variant="secondary" size="sm" label="Continue" onClick={onContinue} />
          ) : null}
          {canRestart ? (
            <Button variant="ghost" size="sm" label="Start over" onClick={onRestart} />
          ) : null}
          {canViewJd ? (
            <Button variant="ghost" size="sm" label="View JD" onClick={onViewJd} />
          ) : null}
        </HStack>
      ) : null}
    </VStack>
  );
}
