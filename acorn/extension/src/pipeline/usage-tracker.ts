import type { AiUsageSummary } from "@acorn/shared/ai-usage";

/** Per-tab usage buckets so parallel pipelines don't mix costs. */
const activeByTab = new Map<number, AiUsageSummary>();

function emptyUsage(): AiUsageSummary {
  return {
    model: null,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    priced: true,
    calls: 0,
  };
}

export function beginPipelineUsageTracking(tabId: number): void {
  activeByTab.set(tabId, emptyUsage());
}

export function addPipelineUsage(tabId: number, part: AiUsageSummary | null | undefined): void {
  const active = activeByTab.get(tabId);
  if (!active || !part) return;

  active.inputTokens += part.inputTokens || 0;
  active.outputTokens += part.outputTokens || 0;
  active.cachedInputTokens += part.cachedInputTokens || 0;
  active.totalTokens += part.totalTokens || 0;
  active.calls = (active.calls || 0) + (part.calls || 1);

  if (typeof part.costUsd === "number") {
    active.costUsd = (active.costUsd || 0) + part.costUsd;
  } else {
    active.priced = false;
  }

  if (part.model) {
    const models = new Set((active.model ? active.model.split("+") : []).filter(Boolean));
    for (const m of part.model.split("+")) {
      if (m) models.add(m);
    }
    active.model = [...models].join("+") || null;
  }
}

export function endPipelineUsageTracking(tabId: number): AiUsageSummary | null {
  const summary = activeByTab.get(tabId) ?? null;
  activeByTab.delete(tabId);
  if (!summary) return null;
  if (typeof summary.costUsd === "number") {
    summary.costUsd = Math.round(summary.costUsd * 1e6) / 1e6;
  }
  return summary;
}

export function isPipelineUsageTracking(tabId: number): boolean {
  return activeByTab.has(tabId);
}

export function rekeyPipelineUsage(fromTabId: number, toTabId: number): void {
  if (fromTabId === toTabId) return;
  const row = activeByTab.get(fromTabId);
  if (!row) return;
  activeByTab.delete(fromTabId);
  if (!activeByTab.has(toTabId)) activeByTab.set(toTabId, row);
}
