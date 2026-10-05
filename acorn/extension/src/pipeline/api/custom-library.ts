import type { RuntimeAttachedFile } from "@acorn/shared/plan-runner/types";
import { authHeaders, getAcornApiUrl } from "../../auth/acorn-auth";
import { extractError, isNestMissingRoute, readId } from "./http";

const CUSTOM_RECOMMEND_UNAVAILABLE = "Custom Recommend needs Library matching on this Acorn API.";

const CUSTOM_LIBRARY_FILE_UNAVAILABLE = "Could not load the recommended Library résumé.";

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
  const base = (_apiUrl || (await getAcornApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/acorn/custom/recommend`, {
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
  const base = (_apiUrl || (await getAcornApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/acorn/custom/library-resumes/${encodeURIComponent(id)}`, {
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
  const base = (_apiUrl || (await getAcornApiUrl())).replace(/\/$/, "");
  const res = await fetch(
    `${base}/acorn/custom/library-resumes/${encodeURIComponent(id)}/preview`,
    {
      headers: await authHeaders(),
    },
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
