import type { RuntimeAttachedFile } from "@acorn/shared/plan-runner/types";
import { authHeaders, getAcornApiUrl } from "../../auth/acorn-auth";
import { extractError, isNestMissingRoute, readId } from "./http";

const CUSTOM_STORED_FILE_UNAVAILABLE =
  "Could not load the stored editor résumé. Custom preview, download, and Fill use the Firestore file from generate, not the default Word export.";

const CUSTOM_PREVIEW_UNAVAILABLE =
  "Résumé preview needs the stored editor file on this Acorn API. Download and Fill use that same Firestore file.";

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
  const base = (_apiUrl || (await getAcornApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/acorn/custom/resumes/${encodeURIComponent(id)}`, {
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

export async function fetchCustomResumePreview(
  generationId: string,
  _apiUrl?: string,
): Promise<string> {
  const id = String(generationId || "").trim();
  if (!id) throw new Error("Missing generation id");
  const base = (_apiUrl || (await getAcornApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/acorn/custom/resumes/${encodeURIComponent(id)}/preview`, {
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
