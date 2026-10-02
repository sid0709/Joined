import { useCallback, useEffect, useState } from "react";
import type { PipelineProgress } from "@acorn/shared/pipeline-types";
import type { DomTreeNode } from "@acorn/shared/tree-export";
import type { DomNode } from "../types";
import { clearTabTree, getTabTree, setTabTree, type TabTreeSummary } from "./tab-tree-cache";

export type InspectKind = "pure" | "meta" | "plan";

export type TabUi = {
  lastFetch: TabTreeSummary | null;
  inspect: { title: string; kind: InspectKind } | null;
};

const EMPTY_TAB_UI: TabUi = {
  lastFetch: null,
  inspect: null,
};

/**
 * Per-tab sidebar UI: the last analyzed tree summary and which inspector is open.
 * Caches the active tab's tree as fill progress reports it, and drops a tab's entry
 * when the tab closes.
 */
export function useTabUi(activeTabId: number | null, progress: PipelineProgress) {
  const [tabUi, setTabUi] = useState<Record<string, TabUi>>({});

  const tabKey = activeTabId != null ? String(activeTabId) : null;
  const ui = (tabKey && tabUi[tabKey]) || EMPTY_TAB_UI;

  const patchTabUi = useCallback((tabId: number, patch: Partial<TabUi>) => {
    setTabUi((prev) => {
      const key = String(tabId);
      return { ...prev, [key]: { ...(prev[key] ?? EMPTY_TAB_UI), ...patch } };
    });
  }, []);

  useEffect(() => {
    const onRemoved = (tabId: number) => {
      clearTabTree(tabId);
      setTabUi((prev) => {
        const key = String(tabId);
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };
    chrome.tabs.onRemoved.addListener(onRemoved);
    return () => chrome.tabs.onRemoved.removeListener(onRemoved);
  }, []);

  const cacheTree = useCallback(
    (
      tabId: number,
      payload: { url: string; title: string; fetchedAt: string; tree: DomTreeNode },
    ) => {
      const existing = getTabTree(tabId);
      if (existing?.fetchedAt === payload.fetchedAt) {
        patchTabUi(tabId, {
          lastFetch: {
            url: existing.url,
            title: existing.title,
            fetchedAt: existing.fetchedAt,
            nodeCount: existing.nodeCount,
          },
        });
        return;
      }
      const nodeCount = countNodes(payload.tree as unknown as DomNode);
      const summary: TabTreeSummary = {
        url: payload.url,
        title: payload.title,
        fetchedAt: payload.fetchedAt,
        nodeCount,
      };
      setTabTree(tabId, { ...summary, tree: payload.tree });
      patchTabUi(tabId, { lastFetch: summary });
    },
    [patchTabUi],
  );

  useEffect(() => {
    if (activeTabId == null || !progress.tree) return;
    if (!isValidTree(progress.tree.tree)) return;
    cacheTree(activeTabId, {
      url: progress.tree.url,
      title: progress.tree.title,
      fetchedAt: progress.tree.fetchedAt,
      tree: progress.tree.tree,
    });
  }, [activeTabId, progress.tree, cacheTree]);

  return { ui, patchTabUi };
}

function isValidTree(tree: unknown): tree is DomNode {
  return Boolean(tree && typeof tree === "object" && "tag" in (tree as object));
}

function countNodes(node: DomNode | undefined): number {
  if (!node) return 0;
  return 1 + (node.children ?? []).reduce((sum, child) => sum + countNodes(child), 0);
}
