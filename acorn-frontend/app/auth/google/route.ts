import { cookies } from "next/headers";
import {
  GOOGLE_AUTH_ROUTE,
  GOOGLE_STATE_COOKIE,
  encodeGoogleState,
  googleStateCookie,
  seeOther,
  signInErrorPath,
  startGoogleSignIn,
} from "@joined/google-signin";
import { acornApiUrl } from "@/lib/config";
import { ROUTES, safeNextPath } from "@/lib/routes";

/** "Continue with Google" posts here; the browser goes on to Google's consent screen. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const field = form?.get("next");
  const next = safeNextPath(typeof field === "string" ? field : undefined);
  const started = await startGoogleSignIn(acornApiUrl());
  if (!started.ok) return seeOther(signInErrorPath(ROUTES.signIn, started.error, next));
  (await cookies()).set(
    GOOGLE_STATE_COOKIE,
    encodeGoogleState({ state: started.state, next }),
    googleStateCookie(process.env.NODE_ENV === "production", GOOGLE_AUTH_ROUTE),
  );
  return seeOther(started.url);
}
