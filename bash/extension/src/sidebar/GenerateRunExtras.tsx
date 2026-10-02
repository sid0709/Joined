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
    <div className="bash-gen-extras">
      {showBar && progress ? <GenerateProgressBar progress={progress} /> : null}
      {canContinue || canViewJd || canRestart ? (
        <div className="bash-gen-actions">
          {canContinue ? (
            <button type="button" className="worker-pool-resume-btn" onClick={onContinue}>
              Continue
            </button>
          ) : null}
          {canRestart ? (
            <button type="button" className="worker-pool-resume-btn" onClick={onRestart}>
              Start over
            </button>
          ) : null}
          {canViewJd ? (
            <button type="button" className="worker-pool-resume-btn" onClick={onViewJd}>
              View JD
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
