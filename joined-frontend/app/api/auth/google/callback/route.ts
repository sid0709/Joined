import { cookies } from "next/headers";
import {
  GOOGLE_STATE_COOKIE,
  finishGoogleSignIn,
  googleStateCookie,
  seeOther,
  signInErrorPath,
} from "@joined/google-signin";
import { writeSessionCookie } from "@/lib/auth/cookie";
import { safeNextPath } from "@/lib/auth/session";
import { joinedApiUrl } from "@/lib/config";
import { ROUTES } from "@/lib/routes";

/** Google sends the job hunter back here with a code to trade for a session. */
export async function GET(request: Request) {
  const jar = await cookies();
  const result = await finishGoogleSignIn(
    joinedApiUrl(),
    new URL(request.url),
    jar.get(GOOGLE_STATE_COOKIE)?.value,
  );
  jar.set(GOOGLE_STATE_COOKIE, "", {
    ...googleStateCookie(process.env.NODE_ENV === "production"),
    maxAge: 0,
  });
  const next = safeNextPath(result.next);
  if (!result.ok) return seeOther(signInErrorPath(ROUTES.signIn, result.error, next));
  await writeSessionCookie(result.token);
  return seeOther(next);
}
