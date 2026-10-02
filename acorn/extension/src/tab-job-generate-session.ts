import type { GenerateCheckpoint } from "@acorn/shared/generate-checkpoint";
import { normalizeGenerateCheckpoint } from "@acorn/shared/generate-checkpoint";
import type { CustomUiProgress } from "./pipeline/custom-generate-progress";
import type { CustomGenerateStatus, CustomWorkKind } from "./tab-custom-session";

export type AcornJobGenerateBinding = {
  jobId: string;
  tabId: number | null;
  workKind: CustomWorkKind | null;
  inputId: string | null;
  generationId: string | null;
  resumeId: string | null;
  recommendedResumeId: string | null;
  recommendedResumeStack: string | null;
  generateStatus: CustomGenerateStatus;
  generateError: string | null;
  generateProgress: CustomUiProgress | null;
  checkpoint: GenerateCheckpoint | null;
  jobDescription: string | null;
};

export const JOB_GENERATE_STORAGE_KEY = "acornJobGenerates";

export type JobGenerateMap = Record<string, AcornJobGenerateBinding>;

function asWorkKind(value: unknown): CustomWorkKind | null {
  return value === "recommend" || value === "generate" ? value : null;
}

function asStatus(value: unknown): CustomGenerateStatus {
  if (value === "queued" || value === "running" || value === "completed" || value === "failed") {
    return value;
  }
  return "idle";
}

function normalizeBinding(row: AcornJobGenerateBinding): AcornJobGenerateBinding {
  return {
    ...row,
    tabId: typeof row.tabId === "number" && Number.isFinite(row.tabId) ? row.tabId : null,
    workKind: asWorkKind(row.workKind),
    inputId: row.inputId ?? null,
    generationId: row.generationId ?? null,
    resumeId: row.resumeId ?? null,
    recommendedResumeId: row.recommendedResumeId ?? null,
    recommendedResumeStack: row.recommendedResumeStack ?? null,
    generateStatus: asStatus(row.generateStatus),
    generateError: row.generateError ?? null,
    generateProgress: row.generateProgress ?? null,
    checkpoint: normalizeGenerateCheckpoint(row.checkpoint),
    jobDescription: row.jobDescription ?? row.checkpoint?.outputs.jobDescription ?? null,
  };
}

function emptyBinding(jobId: string): AcornJobGenerateBinding {
  return {
    jobId,
    tabId: null,
    workKind: null,
    inputId: null,
    generationId: null,
    resumeId: null,
    recommendedResumeId: null,
    recommendedResumeStack: null,
    generateStatus: "idle",
    generateError: null,
    generateProgress: null,
    checkpoint: null,
    jobDescription: null,
  };
}

async function readMap(): Promise<JobGenerateMap> {
  const stored = await chrome.storage.session.get(JOB_GENERATE_STORAGE_KEY);
  const raw = stored[JOB_GENERATE_STORAGE_KEY];
  if (!raw || typeof raw !== "object") return {};
  const map: JobGenerateMap = {};
  for (const [key, row] of Object.entries(raw as JobGenerateMap)) {
    if (row && typeof row === "object") map[key] = normalizeBinding(row);
  }
  return map;
}

async function writeMap(map: JobGenerateMap): Promise<void> {
  await chrome.storage.session.set({ [JOB_GENERATE_STORAGE_KEY]: map });
}

export async function listJobGenerates(): Promise<JobGenerateMap> {
  return readMap();
}

export async function getJobGenerate(jobId: string): Promise<AcornJobGenerateBinding | null> {
  const id = String(jobId || "").trim();
  if (!id) return null;
  const map = await readMap();
  return map[id] ?? null;
}

export async function patchJobGenerate(
  jobId: string,
  patch: Partial<Omit<AcornJobGenerateBinding, "jobId">>,
): Promise<AcornJobGenerateBinding> {
  const id = String(jobId || "").trim();
  if (!id) throw new Error("Missing job id");
  const map = await readMap();
  const existing = map[id] ?? emptyBinding(id);
  const next = normalizeBinding({ ...existing, ...patch, jobId: id });
  map[id] = next;
  await writeMap(map);
  return next;
}

export async function clearJobGenerate(jobId: string): Promise<void> {
  const map = await readMap();
  if (!(jobId in map)) return;
  delete map[jobId];
  await writeMap(map);
}
