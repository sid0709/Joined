import { authHeaders, getAcornApiUrl } from "../../auth/acorn-auth";

export type AcornQaPage = {
  title?: string;
  url?: string;
  job?: {
    id?: string;
    title?: string;
    company?: string;
  } | null;
};

export async function requestQaAnswer(
  input: { question: string; page?: AcornQaPage | null },
  _apiUrl?: string,
): Promise<string> {
  const question = input.question.trim();
  if (!question) throw new Error("Enter a question");
  const base = (_apiUrl || (await getAcornApiUrl())).replace(/\/$/, "");
  const res = await fetch(`${base}/acorn/qa`, {
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
