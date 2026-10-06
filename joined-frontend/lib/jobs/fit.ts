import { meGet, meSend } from "@/lib/me/client";

/** Matches backend-core/fitscore.ModelVersion. */
export const FIT_MODEL_VERSION = "fitscore-v1";
/** Matches joined-backend maxFitJobIDs. */
export const MAX_FIT_BATCH = 100;
/** API criterion id for the role/title dimension. Display it as the role label. */
export const FIT_TITLE_CRITERION = "title";
export const FIT_ROLE_LABEL = "Target role";

export type FitLevel = "yes" | "partial" | "no";

export type FitCriterion = {
  id: string;
  label: string;
  detail: string;
  level: FitLevel;
};

export type JobFit = {
  jobId: string;
  score: number;
  reason: string;
  confidence: string;
  modelVersion: string;
  criteria: FitCriterion[];
  needsVisa: boolean;
};

const LEVELS: readonly FitLevel[] = ["yes", "partial", "no"];

/** Guests and omitted payloads show no score. */
export function visibleFit(signedIn: boolean, fit: JobFit | null | undefined): JobFit | null {
  if (!signedIn || !fit) return null;
  if (!Number.isInteger(fit.score) || fit.score < 0 || fit.score > 100) return null;
  if (typeof fit.reason !== "string") return null;
  return fit;
}

/** API `title` displays as the existing role label. Other ids keep their API label. */
export function criterionLabel(criterion: Pick<FitCriterion, "id" | "label">) {
  if (criterion.id === FIT_TITLE_CRITERION) return criterion.label || FIT_ROLE_LABEL;
  return criterion.label;
}

export function parseJobFit(value: unknown): JobFit | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const score = row.score;
  const reason = row.reason;
  const jobId = typeof row.jobId === "string" ? row.jobId : "";
  if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 100)
    return null;
  if (typeof reason !== "string") return null;
  return {
    jobId,
    score,
    reason,
    confidence: typeof row.confidence === "string" ? row.confidence : "",
    modelVersion: typeof row.modelVersion === "string" ? row.modelVersion : FIT_MODEL_VERSION,
    criteria: parseCriteria(row.criteria),
    needsVisa: row.needsVisa === true,
  };
}

function parseCriteria(value: unknown): FitCriterion[] {
  if (!Array.isArray(value)) return [];
  const criteria: FitCriterion[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const level = row.level;
    if (
      typeof row.id !== "string" ||
      typeof row.label !== "string" ||
      typeof row.detail !== "string"
    ) {
      continue;
    }
    if (typeof level !== "string" || !LEVELS.includes(level as FitLevel)) continue;
    criteria.push({ id: row.id, label: row.label, detail: row.detail, level: level as FitLevel });
  }
  return criteria;
}

export async function fetchJobFit(jobId: string) {
  const body = await meGet<unknown>(`/fit/${encodeURIComponent(jobId)}`);
  const fit = parseJobFit(body);
  if (!fit) return null;
  return { ...fit, jobId: fit.jobId || jobId };
}

export async function fetchJobFits(ids: string[]) {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_FIT_BATCH);
  if (unique.length === 0) return [];
  const body = await meSend<{ scores?: unknown[] }>("/fit", "POST", { jobIds: unique });
  return (body.scores ?? [])
    .map(parseJobFit)
    .filter((fit): fit is JobFit => fit !== null && fit.jobId !== "");
}
