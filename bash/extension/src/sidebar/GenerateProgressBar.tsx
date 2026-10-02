import type { CustomUiProgress } from "../pipeline/custom-generate-progress";

export function GenerateProgressBar({ progress }: { progress: CustomUiProgress }) {
  return (
    <div
      className="oak-gen-progress"
      role="progressbar"
      aria-label={progress.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress.percent}
    >
      {progress.segments.map((state, index) => (
        <span key={index} className={`oak-gen-seg is-${state}`} />
      ))}
    </div>
  );
}
