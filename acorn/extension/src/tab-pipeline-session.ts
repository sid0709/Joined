import {
  IDLE_PIPELINE_PROGRESS,
  mergePipelineProgress,
  type PipelineProgress,
} from "@acorn/shared/pipeline-types";

export const TAB_PIPELINES_STORAGE_KEY = "acornTabPipelines";

export type TabPipelineMap = Record<string, PipelineProgress>;

const writeTail = new Map<number, Promise<void>>();

async function readMap(): Promise<TabPipelineMap> {
  const stored = await chrome.storage.session.get(TAB_PIPELINES_STORAGE_KEY);
  const raw = stored[TAB_PIPELINES_STORAGE_KEY];
  return raw && typeof raw === "object" ? (raw as TabPipelineMap) : {};
}

export async function listTabPipelines(): Promise<TabPipelineMap> {
  return readMap();
}

export async function getTabPipeline(tabId: number): Promise<PipelineProgress | null> {
  const map = await readMap();
  return map[String(tabId)] ?? null;
}

export async function recordTabPipeline(
  tabId: number,
  next: PipelineProgress,
): Promise<PipelineProgress> {
  const map = await readMap();
  const key = String(tabId);
  const prev = map[key] ?? IDLE_PIPELINE_PROGRESS;
  const merged = mergePipelineProgress(prev, next);
  map[key] = merged;
  await chrome.storage.session.set({ [TAB_PIPELINES_STORAGE_KEY]: map });
  return merged;
}

/** Serialize per-tab writes so overlapping progress events cannot clobber each other. */
export function queueTabPipeline(tabId: number, next: PipelineProgress): Promise<void> {
  const prev = writeTail.get(tabId) ?? Promise.resolve();
  const queued = prev
    .then(() => recordTabPipeline(tabId, next))
    .then(() => undefined)
    .catch(() => undefined);
  writeTail.set(tabId, queued);
  return queued;
}

export async function clearTabPipeline(tabId: number): Promise<void> {
  const map = await readMap();
  if (!(String(tabId) in map)) return;
  delete map[String(tabId)];
  await chrome.storage.session.set({ [TAB_PIPELINES_STORAGE_KEY]: map });
}

export async function rekeyTabPipeline(fromTabId: number, toTabId: number): Promise<void> {
  if (fromTabId === toTabId) return;
  await writeTail.get(fromTabId);
  writeTail.delete(fromTabId);
  const map = await readMap();
  const fromKey = String(fromTabId);
  const toKey = String(toTabId);
  if (!(fromKey in map)) return;
  const row = map[fromKey];
  delete map[fromKey];
  map[toKey] = row;
  await chrome.storage.session.set({ [TAB_PIPELINES_STORAGE_KEY]: map });
}
