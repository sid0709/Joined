import { authHeaders, getAthensApiUrl } from "./auth/acorn-auth";
import type { ActionPlan, RuntimeAttachedFile } from "./plan-runner/types";

export interface AiAnalyzePage {
  title?: string;
  url?: string;
  fetchedAt?: string;
}

export interface AiAnalyzeRequest {
  pureTree: string;
  page?: AiAnalyzePage | null;
}

export interface AiAnalyzeResponse {
  ok?: boolean;
  plan?: ActionPlan;
  model?: string;
  responseId?: string | null;
  error?: string;
  usage?: {
    model: string | null;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    totalTokens: number;
    costUsd: number | null;
    priced?: boolean;
    pricingNote?: string;
  };
}

export async function requestAiAnalyze(payload: AiAnalyzeRequest): Promise<AiAnalyzeResponse> {
  const base = getAthensApiUrl();
  const res = await fetch(`${base}/acorn/ai-analyze`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as AiAnalyzeResponse;
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : `AI analyze failed: ${res.status}`,
    );
  }
  if (!data.plan) {
    throw new Error(data.error || "AI backend returned no plan");
  }
  return data;
}

export async function fetchRuntimeFile(): Promise<RuntimeAttachedFile | null> {
  const base = getAthensApiUrl();
  const res = await fetch(`${base}/acorn/runtime-file`, {
    headers: authHeaders(),
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

export type AcornQaPage = {
  title?: string;
  url?: string;
  job?: {
    id?: string;
    title?: string;
    company?: string;
  } | null;
};

export async function requestQaAnswer(input: {
  question: string;
  page?: AcornQaPage | null;
}): Promise<string> {
  const question = input.question.trim();
  if (!question) throw new Error("Enter a question");
  const base = getAthensApiUrl();
  const res = await fetch(`${base}/acorn/qa`, {
    method: "POST",
    headers: authHeaders(),
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
