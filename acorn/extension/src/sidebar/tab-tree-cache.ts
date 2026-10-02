import type { DomTreeNode } from "@acorn/shared/tree-export";

export type TabTreeSummary = {
  url: string;
  title: string;
  fetchedAt: string;
  nodeCount: number;
};

type TabTreeEntry = TabTreeSummary & { tree: DomTreeNode };

const cache = new Map<string, TabTreeEntry>();

export function setTabTree(tabId: number, entry: TabTreeEntry): void {
  cache.set(String(tabId), entry);
}

export function getTabTree(tabId: number): TabTreeEntry | undefined {
  return cache.get(String(tabId));
}

export function clearTabTree(tabId: number): void {
  cache.delete(String(tabId));
}
