import { writeSessionCookie } from "@/lib/auth/cookie";
import {
  EMAIL_API_PATHS,
  EMAIL_MESSAGES,
  emailAuthUserMessage,
  parseSigninInput,
} from "@/lib/auth/email";
import { extractSessionToken, postJoinedAuth } from "@/lib/auth/email-api";
import { joinedApiUrl } from "@/lib/config";

export async function POST(request: Request) {
  const parsed = parseSigninInput(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.message }, { status: 400 });
  try {
    const result = await postJoinedAuth(joinedApiUrl(), EMAIL_API_PATHS.signin, parsed.value);
    if (!result.ok) {
      const status = result.status === 403 ? 401 : result.status;
      return Response.json(
        { error: emailAuthUserMessage("signin", result.status, result.error) },
        { status },
      );
    }
    const token = extractSessionToken(result.data);
    if (!token) return Response.json({ error: EMAIL_MESSAGES.genericFailure }, { status: 502 });
    await writeSessionCookie(token);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: EMAIL_MESSAGES.genericFailure }, { status: 503 });
  }
}
