import type { PipelineProgress } from "../../../shared/pipeline-types";
import { FillIcon, GenerateIcon, RecommendIcon } from "./sidebar-icons";

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
    <div className="oak-booking-bar">
      <button
        type="button"
        className="oak-action-btn"
        onClick={onGenerate}
        disabled={generateDisabled}
        title={generateTitle ?? generateLabel}
      >
        <GenerateIcon />
        <span>{generateLabel}</span>
      </button>
      <button
        type="button"
        className={`oak-action-btn primary fill-card ${fillPhase}`}
        onClick={onFill}
        disabled={fillDisabled}
        title={fillTitle ?? fillLabel}
      >
        <FillIcon />
        <span>{fillLabel}</span>
      </button>
      <button
        type="button"
        className="oak-action-btn"
        onClick={onRecommend}
        disabled={recommendDisabled}
        title={recommendTitle ?? recommendLabel}
      >
        <RecommendIcon />
        <span>{recommendLabel}</span>
      </button>
    </div>
  );
}
