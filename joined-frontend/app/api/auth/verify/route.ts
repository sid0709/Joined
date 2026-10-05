import {
  EMAIL_API_PATHS,
  EMAIL_MESSAGES,
  emailAuthUserMessage,
  parseVerifyInput,
} from "@/lib/auth/email";
import { postJoinedAuth } from "@/lib/auth/email-api";
import { joinedApiUrl } from "@/lib/config";

export async function POST(request: Request) {
  const parsed = parseVerifyInput(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.message }, { status: 400 });
  try {
    const result = await postJoinedAuth(joinedApiUrl(), EMAIL_API_PATHS.verify, parsed.value);
    if (!result.ok) {
      return Response.json(
        { error: emailAuthUserMessage("verify", result.status, result.error) },
        { status: result.status },
      );
    }
    return Response.json({ message: EMAIL_MESSAGES.verifySuccess });
  } catch {
    return Response.json({ error: EMAIL_MESSAGES.genericFailure }, { status: 503 });
  }
}
