import type { GenerateEnqueueCheckpoint } from "../../../shared/generate-checkpoint";
import { readStoredJobDescription } from "../../../shared/job-description";
import type { AiUsageSummary } from "../../../shared/ai-usage";
import type { ActionPlan, RuntimeAttachedFile } from "../../../shared/plan-runner/types";
import { authHeaders, getAthensApiUrl } from "../auth/oak-auth";

export interface AiAnalyzePage {
  title?: string;
  url?: string;
  fetchedAt?: string;
  job?: {
    id: string;
    title: string;
    company: string;
  } | null;
  customGenerationId?: string | null;
  customLibraryResumeId?: string | null;
  customRemembered?: boolean;
  recommendedResumeAvailable?: boolean;
  recommendedResumeStack?: string | null;
}

export interface AiAnalyzeRequest {
  /** Sole tree the planner reads; control attrs ride on each node's `detail`. */
  pureTree: string;
  page?: AiAnalyzePage | null;
}

export interface AiAnalyzeResponse {
  ok?: boolean;
  plan?: ActionPlan;
  model?: string;
  responseId?: string | null;
  error?: string;
  usage?: AiUsageSummary;
}

export async function requestAiAnalyze(
  payload: AiAnalyzeRequest,
  _apiUrl?: string,
): Promise<AiAnalyzeResponse> {
  const base = (_apiUrl || (await getAthensApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/api/oak/ai-analyze`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as AiAnalyzeResponse & {
    message?: string;
    success?: boolean;
  };
  if (!res.ok) {
    throw new Error(extractError(data, `AI analyze failed: ${res.status}`));
  }
  if (!data.plan) {
    throw new Error(extractError(data, "AI backend returned no plan"));
  }
  return data;
}

const GENERIC_HTTP_ERRORS = new Set([
  "Bad Request",
  "Unauthorized",
  "Forbidden",
  "Not Found",
  "Internal Server Error",
]);

function extractError(data: { error?: unknown; message?: unknown }, fallback: string): string {
  const nested =
    data.message && typeof data.message === "object"
      ? (data.message as { error?: unknown; message?: unknown })
      : null;
  for (const candidate of [data.error, nested?.error, data.message, nested?.message]) {
    if (typeof candidate === "string" && candidate.trim()) {
      const text = candidate.trim();
      if (!GENERIC_HTTP_ERRORS.has(text) && !/^Cannot (GET|POST|PUT|PATCH|DELETE)\b/i.test(text)) {
        return text;
      }
    }
  }
  return fallback;
}

function readInputId(data: {
  inputId?: unknown;
  task?: { progress?: { inputId?: unknown } } | null;
}): string {
  const top = String(data.inputId || "").trim();
  if (top) return top;
  return String(data.task?.progress?.inputId || "").trim();
}

function readId(value: unknown): string | null {
  const text = String(value || "").trim();
  return text || null;
}

function isNestMissingRoute(status: number, data: { message?: unknown; error?: unknown }): boolean {
  if (status !== 404) return false;
  const message = typeof data.message === "string" ? data.message : "";
  return /^Cannot (GET|POST|PUT|PATCH|DELETE)\b/i.test(message);
}

const CUSTOM_EDITOR_UNAVAILABLE =
  "Custom generate needs the My Resume Editor pipeline on this Athens host (stored config, template, and variables → Firestore file).";

const CUSTOM_STORED_FILE_UNAVAILABLE =
  "Could not load the stored editor résumé. Custom preview, download, and Fill use the Firestore file from generate, not the default Word export.";

const CUSTOM_PREVIEW_UNAVAILABLE =
  "Résumé preview needs the stored editor file on this Athens host. Download and Fill use that same Firestore file.";

const CUSTOM_EXTRACT_JD_UNAVAILABLE = "Custom generate needs JD extract on this Athens host.";

const CUSTOM_RECOMMEND_UNAVAILABLE = "Custom Recommend needs Library matching on this Athens host.";

const CUSTOM_LIBRARY_FILE_UNAVAILABLE = "Could not load the recommended Library résumé.";

export async function fetchRuntimeFile(_apiUrl?: string): Promise<RuntimeAttachedFile | null> {
  const base = (_apiUrl || (await getAthensApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/api/oak/runtime-file`, {
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
  const base = (_apiUrl || (await getAthensApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/api/oak/jobs/${encodeURIComponent(id)}/recommended-resume`, {
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
  const base = (_apiUrl || (await getAthensApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/api/oak/jobs/${encodeURIComponent(id)}`, {
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

/**
 * Stored Custom résumé from Firestore (same template-applied file the
 * editor writes). Never the personal `/docx` renderDocx export.
 */
export async function fetchCustomResume(
  generationId: string,
  _apiUrl?: string,
): Promise<RuntimeAttachedFile | null> {
  const id = String(generationId || "").trim();
  if (!id) return null;
  const base = (_apiUrl || (await getAthensApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/api/oak/custom/resumes/${encodeURIComponent(id)}`, {
    headers: await authHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    file?: RuntimeAttachedFile;
    generationId?: string | null;
    resumeId?: string | null;
    stack?: string | null;
    error?: string;
    message?: string;
  };
  if (isNestMissingRoute(res.status, data)) {
    throw new Error(CUSTOM_STORED_FILE_UNAVAILABLE);
  }
  if (!res.ok) {
    throw new Error(extractError(data, `Resume file failed: ${res.status}`));
  }
  const responseId = readId(data.generationId);
  if (responseId && responseId !== id) {
    throw new Error("Generated résumé belongs to a different Custom run");
  }
  const file = data.file;
  if (!file?.base64 || !String(file.name || "").trim()) return null;
  const resumeId = readId(data.resumeId) || readId(file.resumeId);
  const stack = String(data.stack || file.label || "").trim();
  return {
    ...file,
    key: file.key || "custom_resume",
    resumeId: resumeId || undefined,
    label: stack || file.name,
  };
}

export type ExtractCustomJdResult = {
  hasJobDescription: boolean;
  jobDescription: string | null;
  reason: string;
};

export type ExtractCustomJdInput = {
  pageText: string;
};

/** Extract posting prose from the Fill AI Analyze pure tree. Does not enqueue generate. */
export async function extractCustomJd(
  input: ExtractCustomJdInput | string,
  _apiUrl?: string,
): Promise<ExtractCustomJdResult> {
  const pageText = typeof input === "string" ? input.trim() : String(input.pageText || "").trim();
  if (!pageText) throw new Error("No readable text on this tab");
  const base = (_apiUrl || (await getAthensApiUrl())).replace(/\/$/, "");
  const extractBody = { pageText };
  const res = await fetch(`${base}/api/oak/custom/extract-jd`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(extractBody),
  });
  const data = (await res.json().catch(() => ({}))) as {
    hasJobDescription?: unknown;
    jobDescription?: unknown;
    reason?: unknown;
    error?: string;
    message?: string;
  };
  if (isNestMissingRoute(res.status, data)) {
    throw new Error(CUSTOM_EXTRACT_JD_UNAVAILABLE);
  }
  if (!res.ok) {
    throw new Error(extractError(data, `JD extract failed: ${res.status}`));
  }
  const jobDescription =
    data.jobDescription == null ? null : String(data.jobDescription).trim() || null;
  const reason = String(data.reason || "").trim();
  return {
    hasJobDescription: Boolean(data.hasJobDescription) && Boolean(jobDescription),
    jobDescription,
    reason,
  };
}

/**
 * Enqueue My Resume Editor generate with extracted JD prose.
 * Athens must apply the signed-in stored template and persist the file
 * to Firestore — same pipeline as the editor, not renderDocx.
 *
 * Optional `jobId` associates the file with a Worker pool job (Fill).
 * Optional `checkpoint` asks Athens to skip completed section steps.
 */
export async function enqueueCustomGenerate(
  input:
    | {
        jobDescription: string;
        jobId?: string | null;
        checkpoint?: GenerateEnqueueCheckpoint | null;
      }
    | string,
  _apiUrl?: string,
): Promise<{ inputId: string }> {
  const description =
    typeof input === "string" ? input.trim() : String(input.jobDescription || "").trim();
  if (!description) throw new Error("No job description to generate from");
  const jobId = typeof input === "string" ? null : String(input.jobId || "").trim() || null;
  const checkpoint = typeof input === "string" ? null : (input.checkpoint ?? null);
  const base = (_apiUrl || (await getAthensApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/api/oak/custom/generate`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      jobDescription: description,
      jobId: jobId || undefined,
      checkpoint: checkpoint || undefined,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    inputId?: string;
    task?: { progress?: { inputId?: string } } | null;
    error?: string;
    message?: string;
    statusCode?: number;
  };
  if (isNestMissingRoute(res.status, data)) {
    throw new Error(CUSTOM_EDITOR_UNAVAILABLE);
  }
  if (!res.ok) {
    throw new Error(extractError(data, `Generate failed: ${res.status}`));
  }
  const inputId = readInputId(data);
  if (!inputId) throw new Error("Generate did not return an input id");
  return { inputId };
}

/**
 * Resume a failed editor generate at `checkpoint.resumeFrom`, reusing
 * `partialSections`. Falls back to a new enqueue when the host has no
 * continue route yet.
 */
export async function continueCustomGenerate(
  input: {
    inputId?: string | null;
    jobDescription: string;
    jobId?: string | null;
    checkpoint: GenerateEnqueueCheckpoint;
  },
  _apiUrl?: string,
): Promise<{ inputId: string }> {
  const existingId = String(input.inputId || "").trim();
  const description = String(input.jobDescription || "").trim();
  if (!description) throw new Error("No job description to generate from");
  const base = (_apiUrl || (await getAthensApiUrl())).replace(/\/$/, "");
  if (existingId) {
    const res = await fetch(
      `${base}/api/oak/custom/generate/${encodeURIComponent(existingId)}/continue`,
      {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          jobDescription: description,
          jobId: input.jobId || undefined,
          checkpoint: input.checkpoint,
        }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      inputId?: string;
      task?: { progress?: { inputId?: string } } | null;
      error?: string;
      message?: string;
    };
    if (!isNestMissingRoute(res.status, data)) {
      if (!res.ok) {
        throw new Error(extractError(data, `Continue generate failed: ${res.status}`));
      }
      const inputId = readInputId(data) || existingId;
      if (!inputId) throw new Error("Continue did not return an input id");
      return { inputId };
    }
  }
  return enqueueCustomGenerate(
    {
      jobDescription: description,
      jobId: input.jobId,
      checkpoint: input.checkpoint,
    },
    _apiUrl,
  );
}

export type CustomGeneratePoll = {
  status: string;
  generationId: string | null;
  resumeId: string | null;
  error: string | null;
  httpStatus: number;
  partialSections: unknown;
  progress: unknown;
};

export async function pollCustomGenerate(
  inputId: string,
  _apiUrl?: string,
): Promise<CustomGeneratePoll> {
  const id = String(inputId || "").trim();
  if (!id) throw new Error("Missing generation input");
  const base = (_apiUrl || (await getAthensApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/api/oak/custom/generate/${encodeURIComponent(id)}`, {
    headers: await authHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    generationId?: string | null;
    resumeId?: string | null;
    result?: {
      generationId?: string | null;
      resumeId?: string | null;
    } | null;
    error?: string;
    message?: string;
    partialSections?: unknown;
    progress?: unknown;
  };
  if (isNestMissingRoute(res.status, data)) {
    throw new Error(CUSTOM_EDITOR_UNAVAILABLE);
  }
  if (!res.ok && res.status !== 202) {
    throw new Error(extractError(data, `Generate status failed: ${res.status}`));
  }
  const result = data.result && typeof data.result === "object" ? data.result : null;
  return {
    status: String(data.status || "").trim() || "queued",
    generationId: readId(result?.generationId) || readId(data.generationId),
    resumeId: readId(result?.resumeId) || readId(data.resumeId),
    error: typeof data.error === "string" && data.error.trim() ? data.error : null,
    httpStatus: res.status,
    partialSections: data.partialSections ?? null,
    progress: data.progress ?? null,
  };
}

export type OakQaPage = {
  title?: string;
  url?: string;
  job?: {
    id?: string;
    title?: string;
    company?: string;
  } | null;
};

export async function requestQaAnswer(
  input: { question: string; page?: OakQaPage | null },
  _apiUrl?: string,
): Promise<string> {
  const question = input.question.trim();
  if (!question) throw new Error("Enter a question");
  const base = (_apiUrl || (await getAthensApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/api/oak/qa`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      question,
      page: input.page ?? null,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    answer?: string;
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
          ? data.message
          : `Q&A failed: ${res.status}`,
    );
  }
  const answer = typeof data.answer === "string" ? data.answer.trim() : "";
  if (!answer) throw new Error("Writer returned no answer");
  return answer;
}

export type CustomLibraryRecommendResult = {
  recommendedResumeId: string;
  recommendedResumeStack: string;
  recommendedResumeReason: string | null;
  warning: string | null;
};

export async function recommendCustomLibrary(
  input: { jobDescription: string; title?: string; url?: string },
  _apiUrl?: string,
): Promise<CustomLibraryRecommendResult> {
  const jobDescription = input.jobDescription.trim();
  if (!jobDescription) throw new Error("No readable text on this tab");
  const base = (_apiUrl || (await getAthensApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/api/oak/custom/recommend`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      jobDescription,
      title: input.title?.trim() || undefined,
      url: input.url?.trim() || undefined,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    recommendedResumeId?: unknown;
    recommendedResumeStack?: unknown;
    recommendedResumeReason?: unknown;
    warning?: unknown;
    error?: string;
    message?: string;
  };
  if (isNestMissingRoute(res.status, data)) {
    throw new Error(CUSTOM_RECOMMEND_UNAVAILABLE);
  }
  if (!res.ok) {
    throw new Error(extractError(data, `Recommend failed: ${res.status}`));
  }
  const recommendedResumeId = readId(data.recommendedResumeId);
  const recommendedResumeStack = String(data.recommendedResumeStack || "").trim();
  if (!recommendedResumeId || !recommendedResumeStack) {
    throw new Error(extractError(data, "No Library resume matched this posting"));
  }
  return {
    recommendedResumeId,
    recommendedResumeStack,
    recommendedResumeReason: String(data.recommendedResumeReason || "").trim() || null,
    warning: String(data.warning || "").trim() || null,
  };
}

export async function fetchCustomLibraryResume(
  resumeId: string,
  _apiUrl?: string,
): Promise<RuntimeAttachedFile | null> {
  const id = String(resumeId || "").trim();
  if (!id) return null;
  const base = (_apiUrl || (await getAthensApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/api/oak/custom/library-resumes/${encodeURIComponent(id)}`, {
    headers: await authHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    file?: RuntimeAttachedFile;
    resumeId?: string | null;
    stack?: string | null;
    error?: string;
    message?: string;
  };
  if (isNestMissingRoute(res.status, data)) {
    throw new Error(CUSTOM_LIBRARY_FILE_UNAVAILABLE);
  }
  if (!res.ok) {
    throw new Error(extractError(data, `Resume file failed: ${res.status}`));
  }
  const responseId = readId(data.resumeId);
  if (responseId && responseId !== id) {
    throw new Error("Library résumé belongs to a different Recommend run");
  }
  const file = data.file;
  if (!file?.base64 || !String(file.name || "").trim()) return null;
  const stack = String(data.stack || file.label || "").trim();
  return {
    ...file,
    key: file.key || "recommended_resume",
    resumeId: responseId || id,
    label: stack || file.name,
  };
}

export async function fetchCustomLibraryResumePreview(
  resumeId: string,
  _apiUrl?: string,
): Promise<string> {
  const id = String(resumeId || "").trim();
  if (!id) throw new Error("Missing resume id");
  const base = (_apiUrl || (await getAthensApiUrl())).replace(/\/$/, "");
  const res = await fetch(
    `${base}/api/oak/custom/library-resumes/${encodeURIComponent(id)}/preview`,
    { headers: await authHeaders() },
  );
  const data = (await res.json().catch(() => ({}))) as {
    html?: string;
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    if (isNestMissingRoute(res.status, data)) {
      throw new Error(CUSTOM_LIBRARY_FILE_UNAVAILABLE);
    }
    throw new Error(extractError(data, `Resume preview failed: ${res.status}`));
  }
  const html = typeof data.html === "string" ? data.html : "";
  if (!html.trim()) throw new Error("Library résumé preview is empty");
  return html;
}

export async function fetchCustomResumePreview(
  generationId: string,
  _apiUrl?: string,
): Promise<string> {
  const id = String(generationId || "").trim();
  if (!id) throw new Error("Missing generation id");
  const base = (_apiUrl || (await getAthensApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/api/oak/custom/resumes/${encodeURIComponent(id)}/preview`, {
    headers: await authHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    html?: string;
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    if (isNestMissingRoute(res.status, data)) {
      throw new Error(CUSTOM_PREVIEW_UNAVAILABLE);
    }
    throw new Error(extractError(data, `Resume preview failed: ${res.status}`));
  }
  const html = typeof data.html === "string" ? data.html : "";
  if (!html.trim()) throw new Error("Generated résumé preview is empty");
  return html;
}

export async function fetchGeneratedResumePreview(
  jobId: string,
  _apiUrl?: string,
): Promise<string> {
  const id = String(jobId || "").trim();
  if (!id) throw new Error("Missing job id");
  const base = (_apiUrl || (await getAthensApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/api/oak/jobs/${encodeURIComponent(id)}/resume-preview`, {
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
