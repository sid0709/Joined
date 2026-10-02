import { readStoredJobDescription } from "@acorn/shared/job-description";

export type AcornWorkerJob = {
  id: string;
  title: string;
  company: string;
  companyLogoUrl?: string;
  location: string;
  workMode?: string;
  applyUrl: string;
  workerPoolAt: string | null;
  generatedResume?: boolean;
  recommendedResumeStack: string | null;
  recommendedResumeId: string | null;
  recommendedResumeReason: string | null;
  recommendWarning: string | null;
  recommendedAt: string | null;
  /** Already-saved posting prose from Job Search / Worker pool. */
  jobDescription: string | null;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableText(value: unknown): string | null {
  const text = asText(value);
  return text || null;
}

export function mapAcornWorkerJob(raw: unknown): AcornWorkerJob | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const id = asText(row.id || row.jobId);
  if (!id) return null;
  return {
    id,
    title: asText(row.title) || "Untitled",
    company: asText(row.company),
    companyLogoUrl: asNullableText(row.companyLogoUrl) ?? undefined,
    location: asText(row.location),
    workMode: asNullableText(row.workMode) ?? undefined,
    applyUrl: asText(row.applyUrl),
    workerPoolAt: asNullableText(row.workerPoolAt),
    generatedResume: Boolean(row.generatedResume),
    recommendedResumeStack: asNullableText(row.recommendedResumeStack),
    recommendedResumeId: asNullableText(row.recommendedResumeId),
    recommendedResumeReason: asNullableText(row.recommendedResumeReason),
    recommendWarning: asNullableText(row.recommendWarning),
    recommendedAt: asNullableText(row.recommendedAt),
    jobDescription: readStoredJobDescription(row),
  };
}

export function mapAcornWorkerJobs(raw: unknown): AcornWorkerJob[] {
  if (!Array.isArray(raw)) return [];
  const jobs: AcornWorkerJob[] = [];
  for (const row of raw) {
    const job = mapAcornWorkerJob(row);
    if (job) jobs.push(job);
  }
  return jobs;
}
