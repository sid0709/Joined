import { EMAIL_API_PATHS, EMAIL_MESSAGES, emailAuthUserMessage, verifyRequest } from "./email";

export type JoinedAuthResult =
  | { ok: true; status: number; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export function extractSessionToken(data: Record<string, unknown>): string {
  return typeof data.token === "string" ? data.token : "";
}

export async function postJoinedAuth(
  apiUrl: string,
  path: string,
  body: unknown,
): Promise<JoinedAuthResult> {
  const response = await fetch(new URL(path, `${apiUrl}/`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: typeof data.error === "string" ? data.error : "",
    };
  }
  return { ok: true, status: response.status, data };
}

export async function verifyEmailToken(
  apiUrl: string,
  token: string,
): Promise<{ ok: boolean; message: string }> {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, message: EMAIL_MESSAGES.verifyMissing };
  try {
    const result = await postJoinedAuth(apiUrl, EMAIL_API_PATHS.verify, verifyRequest(trimmed));
    if (result.ok) return { ok: true, message: EMAIL_MESSAGES.verifySuccess };
    return { ok: false, message: emailAuthUserMessage("verify", result.status, result.error) };
  } catch {
    return { ok: false, message: EMAIL_MESSAGES.genericFailure };
  }
}
