import { useEffect, useMemo, useRef } from "react";
import type { PipelineProgress } from "@acorn/shared/pipeline-types";
import type { ActionPlan, RunStepRecord } from "@acorn/shared/plan-runner/types";
import {
  collectLines,
  formatMetaTreePreview,
  formatPureTreePreview,
  iterateMetaTreeLines,
  iteratePureTreeLines,
  splitDomTree,
} from "@acorn/shared/tree-export";
import { useInspectWindow } from "./InspectPanel";
import { getTabTree } from "./tab-tree-cache";
import { useShownCount } from "./use-shown-count";
import type { InspectKind, TabUi } from "./use-tab-ui";

const STEP_PAGE = 30;

/**
 * The active tab's analyzed tree and plan run: paged plan steps, step counts, and the
 * text shown in the Pure Tree / Meta Tree / AI Analyze inspector.
 */
export function usePlanInspect({
  activeTabId,
  ui,
  progress,
  patchTabUi,
}: {
  activeTabId: number | null;
  ui: TabUi;
  progress: PipelineProgress;
  patchTabUi: (tabId: number, patch: Partial<TabUi>) => void;
}) {
  const lastFetch = ui.lastFetch;
  const inspectKind = ui.inspect?.kind ?? null;
  const treeStamp = lastFetch?.fetchedAt;

  const splitTrees = useMemo(() => {
    if (inspectKind !== "pure" && inspectKind !== "meta") return null;
    if (activeTabId == null) return null;
    const tree = getTabTree(activeTabId)?.tree;
    if (!tree) return null;
    return splitDomTree(tree);
  }, [inspectKind, activeTabId, treeStamp]);

  const plan: ActionPlan | undefined = progress.plan;
  const steps: RunStepRecord[] = progress.steps ?? [];
  const nodeCount = lastFetch?.nodeCount ?? 0;

  const {
    shownCount: stepShown,
    loadMore: loadMoreSteps,
    ensureCount: ensureStepCount,
  } = useShownCount(STEP_PAGE, plan);
  const visibleSteps = steps.slice(0, stepShown);
  const hasMoreSteps = stepShown < steps.length;
  const stepsListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const runningIdx = steps.findIndex(
      (step) => step.status === "running" || step.status === "paused",
    );
    if (runningIdx >= 0) ensureStepCount(runningIdx + 1);
  }, [steps, ensureStepCount]);

  const inspectWindow = useInspectWindow(inspectKind);

  const inspectView = useMemo(() => {
    if (!inspectKind) return null;
    if (inspectKind === "plan") {
      const all = JSON.stringify(plan ?? {}, null, 2).split("\n");
      return {
        lines: all.slice(0, inspectWindow.shownCount),
        hasMore: inspectWindow.shownCount < all.length,
        copy: () => navigator.clipboard.writeText(all.join("\n")),
      };
    }
    if (!splitTrees) return { lines: [] as string[], hasMore: false, copy: async () => undefined };
    if (inspectKind === "pure") {
      const collected = collectLines(
        iteratePureTreeLines(splitTrees.pure),
        inspectWindow.shownCount,
      );
      return {
        ...collected,
        copy: () => navigator.clipboard.writeText(formatPureTreePreview(splitTrees.pure)),
      };
    }
    const collected = collectLines(
      iterateMetaTreeLines(splitTrees.meta, splitTrees.pure),
      inspectWindow.shownCount,
    );
    return {
      ...collected,
      copy: () =>
        navigator.clipboard.writeText(formatMetaTreePreview(splitTrees.meta, splitTrees.pure)),
    };
  }, [inspectKind, inspectWindow.shownCount, plan, splitTrees]);

  const stepSummary = {
    ok: steps.filter((s) => s.status === "ok").length,
    skipped: steps.filter((s) => s.status === "skipped").length,
    blocked: steps.filter((s) => s.status === "blocked").length,
    failed: steps.filter((s) => s.status === "failed" || s.status === "aborted").length,
  };

  const openInspect = (kind: InspectKind, title: string) => {
    if (activeTabId == null) return;
    patchTabUi(activeTabId, { inspect: { title, kind } });
  };

  return {
    lastFetch,
    plan,
    steps,
    nodeCount,
    visibleSteps,
    hasMoreSteps,
    loadMoreSteps,
    stepsListRef,
    inspectWindow,
    inspectView,
    stepSummary,
    openInspect,
  };
}
