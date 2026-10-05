import { emailAuthCsrfReject } from "./csrf";
import {
  EMAIL_API_PATHS,
  EMAIL_MESSAGES,
  emailAuthUserMessage,
  parseForgotInput,
  parseResetInput,
  parseSigninInput,
  parseSignupInput,
  parseVerifyInput,
  verifyRequest,
  type EmailAuthAction,
} from "./email";

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

export type WriteSession = (token: string) => Promise<void>;

async function forwardEmailAuth<T>(
  request: Request,
  apiUrl: string,
  parse: (body: unknown) => { ok: true; value: T } | { ok: false; message: string },
  path: string,
  action: EmailAuthAction,
  success: (data: Record<string, unknown>) => Promise<Response> | Response,
): Promise<Response> {
  const rejected = emailAuthCsrfReject(request);
  if (rejected) return rejected;
  const parsed = parse(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.message }, { status: 400 });
  try {
    const result = await postJoinedAuth(apiUrl, path, parsed.value);
    if (!result.ok) {
      const status = action === "signin" && result.status === 403 ? 401 : result.status;
      return Response.json(
        { error: emailAuthUserMessage(action, result.status, result.error) },
        { status },
      );
    }
    return await success(result.data);
  } catch {
    return Response.json({ error: EMAIL_MESSAGES.genericFailure }, { status: 503 });
  }
}

export async function handleEmailSignup(request: Request, apiUrl: string): Promise<Response> {
  return forwardEmailAuth(request, apiUrl, parseSignupInput, EMAIL_API_PATHS.signup, "signup", () =>
    Response.json({ message: EMAIL_MESSAGES.signupSuccess }),
  );
}

export async function handleEmailSignin(
  request: Request,
  apiUrl: string,
  writeSession: WriteSession,
): Promise<Response> {
  return forwardEmailAuth(
    request,
    apiUrl,
    parseSigninInput,
    EMAIL_API_PATHS.signin,
    "signin",
    async (data) => {
      const token = extractSessionToken(data);
      if (!token) return Response.json({ error: EMAIL_MESSAGES.genericFailure }, { status: 502 });
      await writeSession(token);
      return Response.json({ ok: true });
    },
  );
}

export async function handleEmailVerify(request: Request, apiUrl: string): Promise<Response> {
  return forwardEmailAuth(request, apiUrl, parseVerifyInput, EMAIL_API_PATHS.verify, "verify", () =>
    Response.json({ message: EMAIL_MESSAGES.verifySuccess }),
  );
}

export async function handlePasswordResetRequest(
  request: Request,
  apiUrl: string,
): Promise<Response> {
  return forwardEmailAuth(
    request,
    apiUrl,
    parseForgotInput,
    EMAIL_API_PATHS.resetRequest,
    "forgot",
    () => Response.json({ message: EMAIL_MESSAGES.forgotSuccess }),
  );
}

export async function handlePasswordReset(request: Request, apiUrl: string): Promise<Response> {
  return forwardEmailAuth(request, apiUrl, parseResetInput, EMAIL_API_PATHS.reset, "reset", () =>
    Response.json({ message: EMAIL_MESSAGES.resetSuccess }),
  );
}
