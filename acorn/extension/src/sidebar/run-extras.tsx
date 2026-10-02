import type { ReactNode } from "react";
import type { CustomUiProgress } from "../pipeline/custom-generate-progress";
import { GenerateProgressBar } from "./GenerateProgressBar";
import type { SidebarListCardAction } from "./SidebarListCard";

type RunExtrasInput = {
  progress: CustomUiProgress | null;
  showBar: boolean;
  canContinue: boolean;
  canRestart: boolean;
  canViewJd: boolean;
  onContinue?: () => void;
  onRestart?: () => void;
  onViewJd?: () => void;
};

/** A row's Generate / Recommend run: its progress bar and the actions that only apply sometimes. */
export function runExtras({
  progress,
  showBar,
  canContinue,
  canRestart,
  canViewJd,
  onContinue,
  onRestart,
  onViewJd,
}: RunExtrasInput): { more: SidebarListCardAction[]; progress: ReactNode } {
  const more: SidebarListCardAction[] = [];
  if (canContinue && onContinue) {
    more.push({ label: "Continue", title: "Continue from the failed step", onClick: onContinue });
  }
  if (canRestart && onRestart) {
    more.push({ label: "Start over", title: "Start over", onClick: onRestart });
  }
  if (canViewJd && onViewJd) {
    more.push({ label: "View JD", title: "View job description", onClick: onViewJd });
  }
  return {
    more,
    progress: showBar && progress ? <GenerateProgressBar progress={progress} /> : null,
  };
}
