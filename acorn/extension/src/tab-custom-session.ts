import type { GenerateCheckpoint } from "@acorn/shared/generate-checkpoint";
import { normalizeGenerateCheckpoint } from "@acorn/shared/generate-checkpoint";
import type { CustomUiProgress } from "./pipeline/custom-generate-progress";

export type CustomGenerateStatus = "idle" | "queued" | "running" | "completed" | "failed";

export type CustomResumeMode = "generate" | "recommend";
export type CustomWorkKind = "generate" | "recommend";

export type AcornCustomTabBinding = {
  tabId: number;
  url: string;
  title: string;
  favIconUrl: string | null;
  rememberedAt: string;
  resumeMode: CustomResumeMode;
  /** Last Generate or Recommend started on this tab. */
  workKind: CustomWorkKind | null;
  inputId: string | null;
  generationId: string | null;
  /** Firestore id of the template-applied editor file, when the host returns it. */
  resumeId: string | null;
  recommendedResumeId: string | null;
  recommendedResumeStack: string | null;
  recommendedResumeReason: string | null;
  generateStatus: CustomGenerateStatus;
  generateError: string | null;
  generateProgress?: CustomUiProgress | null;
  checkpoint?: GenerateCheckpoint | null;
  /** JD used for the current/last generate or recommend run (View JD). */
  jobDescription?: string | null;
};

export type CustomTabAttachment = {
  tabId: number;
  active: boolean;
};

export const TAB_CUSTOM_STORAGE_KEY = "acornCustomTabs";

export type CustomTabMap = Record<string, AcornCustomTabBinding>;

function asResumeMode(value: unknown): CustomResumeMode {
  return value === "recommend" ? "recommend" : "generate";
}

function asWorkKind(value: unknown): CustomWorkKind | null {
  return value === "recommend" || value === "generate" ? value : null;
}

function normalizeBinding(row: AcornCustomTabBinding): AcornCustomTabBinding {
  return {
    ...row,
    favIconUrl: row.favIconUrl ?? null,
    resumeMode: asResumeMode(row.resumeMode),
    workKind: asWorkKind(row.workKind),
    resumeId: row.resumeId ?? null,
    recommendedResumeId: row.recommendedResumeId ?? null,
    recommendedResumeStack: row.recommendedResumeStack ?? null,
    recommendedResumeReason: row.recommendedResumeReason ?? null,
    checkpoint: normalizeGenerateCheckpoint(row.checkpoint),
    jobDescription: row.jobDescription ?? row.checkpoint?.outputs.jobDescription ?? null,
  };
}

export function customTabHasResume(tab: AcornCustomTabBinding): boolean {
  return tab.resumeMode === "recommend"
    ? Boolean(String(tab.recommendedResumeId || "").trim())
    : Boolean(String(tab.generationId || "").trim());
}

async function readMap(): Promise<CustomTabMap> {
  const stored = await chrome.storage.session.get(TAB_CUSTOM_STORAGE_KEY);
  const raw = stored[TAB_CUSTOM_STORAGE_KEY];
  if (!raw || typeof raw !== "object") return {};
  const map: CustomTabMap = {};
  for (const [key, row] of Object.entries(raw as CustomTabMap)) {
    if (row && typeof row === "object") map[key] = normalizeBinding(row);
  }
  return map;
}

async function writeMap(map: CustomTabMap): Promise<void> {
  await chrome.storage.session.set({ [TAB_CUSTOM_STORAGE_KEY]: map });
}

export async function listCustomTabs(): Promise<CustomTabMap> {
  return readMap();
}

export async function getCustomTab(tabId: number): Promise<AcornCustomTabBinding | null> {
  const map = await readMap();
  return map[String(tabId)] ?? null;
}

export async function rememberCustomTab(input: {
  tabId: number;
  url: string;
  title: string;
  favIconUrl?: string | null;
  resumeMode?: CustomResumeMode;
}): Promise<AcornCustomTabBinding> {
  const map = await readMap();
  const key = String(input.tabId);
  const existing = map[key];
  const favIconUrl = input.favIconUrl?.trim() || existing?.favIconUrl || null;
  const next: AcornCustomTabBinding = existing
    ? {
        ...existing,
        url: input.url || existing.url,
        title: input.title || existing.title,
        favIconUrl,
      }
    : {
        tabId: input.tabId,
        url: input.url,
        title: input.title,
        favIconUrl,
        rememberedAt: new Date().toISOString(),
        resumeMode: input.resumeMode === "recommend" ? "recommend" : "generate",
        workKind: null,
        inputId: null,
        generationId: null,
        resumeId: null,
        recommendedResumeId: null,
        recommendedResumeStack: null,
        recommendedResumeReason: null,
        generateStatus: "idle",
        generateError: null,
        generateProgress: null,
        checkpoint: null,
        jobDescription: null,
      };
  map[key] = next;
  await writeMap(map);
  return next;
}

export async function patchCustomTab(
  tabId: number,
  patch: Partial<Omit<AcornCustomTabBinding, "tabId">>,
): Promise<AcornCustomTabBinding | null> {
  const map = await readMap();
  const key = String(tabId);
  const existing = map[key];
  if (!existing) return null;
  const next = normalizeBinding({ ...existing, ...patch, tabId });
  map[key] = next;
  await writeMap(map);
  return next;
}

export async function refreshCustomTabMeta(
  tabId: number,
  meta: { url?: string; title?: string; favIconUrl?: string | null },
): Promise<void> {
  const map = await readMap();
  const key = String(tabId);
  const existing = map[key];
  if (!existing) return;
  const url = typeof meta.url === "string" && meta.url.trim() ? meta.url : existing.url;
  const title = typeof meta.title === "string" && meta.title.trim() ? meta.title : existing.title;
  const favIconUrl =
    typeof meta.favIconUrl === "string" && meta.favIconUrl.trim()
      ? meta.favIconUrl.trim()
      : existing.favIconUrl;
  if (url === existing.url && title === existing.title && favIconUrl === existing.favIconUrl) {
    return;
  }
  map[key] = { ...existing, url, title, favIconUrl };
  await writeMap(map);
}

export async function unbindCustomTab(tabId: number): Promise<void> {
  const map = await readMap();
  if (!(String(tabId) in map)) return;
  delete map[String(tabId)];
  await writeMap(map);
}

export async function rekeyCustomTab(fromTabId: number, toTabId: number): Promise<void> {
  if (fromTabId === toTabId) return;
  const map = await readMap();
  const fromKey = String(fromTabId);
  const toKey = String(toTabId);
  const row = map[fromKey];
  if (!row) return;
  delete map[fromKey];
  map[toKey] = { ...row, tabId: toTabId };
  await writeMap(map);
}
