import type { AiUsageSummary } from "@acorn/shared/ai-usage";
import type { ActionPlan } from "@acorn/shared/plan-runner/types";
import { authHeaders, getAcornApiUrl } from "../../auth/acorn-auth";
import { extractError } from "./http";

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
  const base = (_apiUrl || (await getAcornApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/acorn/ai-analyze`, {
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
