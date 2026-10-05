import type { GenerateEnqueueCheckpoint } from "@acorn/shared/generate-checkpoint";
import { authHeaders, getAcornApiUrl } from "../../auth/acorn-auth";
import { extractError, isNestMissingRoute, readId, readInputId } from "./http";

const CUSTOM_EDITOR_UNAVAILABLE =
  "Custom generate needs the My Resume Editor pipeline on this Acorn API (stored config, template, and variables → Firestore file).";

const CUSTOM_EXTRACT_JD_UNAVAILABLE = "Custom generate needs JD extract on this Acorn API.";

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
  const base = (_apiUrl || (await getAcornApiUrl())).replace(/\/$/, "");
  const extractBody = { pageText };
  const res = await fetch(`${base}/acorn/custom/extract-jd`, {
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
 * The Joined API must apply the signed-in stored template and persist the file
 * to Firestore — same pipeline as the editor, not renderDocx.
 *
 * Optional `jobId` associates the file with a Worker pool job (Fill).
 * Optional `checkpoint` asks the Joined API to skip completed section steps.
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
  const base = (_apiUrl || (await getAcornApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/acorn/custom/generate`, {
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
  const base = (_apiUrl || (await getAcornApiUrl())).replace(/\/$/, "");
  if (existingId) {
    const res = await fetch(
      `${base}/acorn/custom/generate/${encodeURIComponent(existingId)}/continue`,
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
  const base = (_apiUrl || (await getAcornApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/acorn/custom/generate/${encodeURIComponent(id)}`, {
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
