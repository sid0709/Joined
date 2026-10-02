import { cookies } from "next/headers";
import {
  GOOGLE_MODE_FIELD,
  GOOGLE_STATE_COOKIE,
  encodeGoogleState,
  googleStateCookie,
  seeOther,
  signInErrorPath,
  startGoogleSignIn,
} from "@joined/google-signin";
import { safeNextPath } from "@/lib/auth/session";
import { joinedApiUrl } from "@/lib/config";
import { ROUTES } from "@/lib/routes";

/**
 * "Continue with Google" posts here, and people go on to Google's consent screen.
 * A sign-up also says whether the new account hunts for jobs or hires.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const field = form?.get("next");
  const mode = form?.get(GOOGLE_MODE_FIELD);
  const next = safeNextPath(typeof field === "string" ? field : undefined);
  const started = await startGoogleSignIn(joinedApiUrl(), {
    mode: typeof mode === "string" ? mode : undefined,
  });
  if (!started.ok) return seeOther(signInErrorPath(ROUTES.signIn, started.error, next));
  (await cookies()).set(
    GOOGLE_STATE_COOKIE,
    encodeGoogleState({ state: started.state, next }),
    googleStateCookie(process.env.NODE_ENV === "production"),
  );
  return seeOther(started.url);
}
