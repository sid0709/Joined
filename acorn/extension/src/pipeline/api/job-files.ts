import { readStoredJobDescription } from "@acorn/shared/job-description";
import type { RuntimeAttachedFile } from "@acorn/shared/plan-runner/types";
import { authHeaders, getAcornApiUrl } from "../../auth/acorn-auth";
import { extractError, isNestMissingRoute } from "./http";

export async function fetchRuntimeFile(_apiUrl?: string): Promise<RuntimeAttachedFile | null> {
  const base = (_apiUrl || (await getAcornApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/acorn/runtime-file`, {
    headers: await authHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    file?: RuntimeAttachedFile;
    error?: string;
  };
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(
      typeof data.error === "string" ? data.error : `Runtime file failed: ${res.status}`,
    );
  }
  return data.file ?? null;
}

export async function fetchRecommendedResume(
  jobId: string,
  _apiUrl?: string,
): Promise<RuntimeAttachedFile | null> {
  const id = String(jobId || "").trim();
  if (!id) return null;
  const base = (_apiUrl || (await getAcornApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/acorn/jobs/${encodeURIComponent(id)}/recommended-resume`, {
    headers: await authHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    file?: RuntimeAttachedFile;
    jobId?: string | null;
    resumeId?: string | null;
    stack?: string | null;
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(extractError(data, `Resume file failed: ${res.status}`));
  }
  const responseJobId = String(data.jobId || "").trim();
  if (responseJobId && responseJobId !== id) {
    throw new Error("Recommended resume belongs to a different job");
  }
  const file = data.file;
  if (!file?.base64 || !String(file.name || "").trim()) return null;
  const resumeId = String(data.resumeId || file.resumeId || "").trim();
  const stack = String(data.stack || file.label || "").trim();
  return {
    ...file,
    key: file.key || "recommended_resume",
    resumeId: resumeId || undefined,
    jobId: responseJobId || id,
    label: stack || file.name,
  };
}

export const NO_STORED_JD = "This job has no stored job description";

/** Fill mode: JD already saved on the Worker pool job, never re-analyzed. */
export async function fetchStoredJobDescription(jobId: string, _apiUrl?: string): Promise<string> {
  const id = String(jobId || "").trim();
  if (!id) throw new Error(NO_STORED_JD);
  const base = (_apiUrl || (await getAcornApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/acorn/jobs/${encodeURIComponent(id)}`, {
    headers: await authHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    job?: unknown;
    jobs?: unknown;
    error?: string;
    message?: string;
  };
  if (res.status === 404 || isNestMissingRoute(res.status, data)) {
    throw new Error(NO_STORED_JD);
  }
  if (!res.ok) {
    throw new Error(extractError(data, `Job JD failed: ${res.status}`));
  }
  const jd = readStoredJobDescription(data.job) || readStoredJobDescription(data) || null;
  if (!jd) throw new Error(NO_STORED_JD);
  return jd;
}

export async function fetchGeneratedResumePreview(
  jobId: string,
  _apiUrl?: string,
): Promise<string> {
  const id = String(jobId || "").trim();
  if (!id) throw new Error("Missing job id");
  const base = (_apiUrl || (await getAcornApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/acorn/jobs/${encodeURIComponent(id)}/resume-preview`, {
    headers: await authHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    html?: string;
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
          ? data.message
          : `Resume preview failed: ${res.status}`,
    );
  }
  const html = typeof data.html === "string" ? data.html : "";
  if (!html.trim()) throw new Error("Generated résumé preview is empty");
  return html;
}
