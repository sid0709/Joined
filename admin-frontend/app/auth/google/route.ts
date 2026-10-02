import { cookies } from "next/headers";
import {
  GOOGLE_AUTH_ROUTE,
  GOOGLE_STATE_COOKIE,
  encodeGoogleState,
  googleStateCookie,
  sameSiteNextPath,
  seeOther,
  signInErrorPath,
  startGoogleSignIn,
} from "@joined/google-signin";
import { ROUTES } from "@/lib/nav";
import { adminApiUrl, adminHeaders } from "@/lib/server/env";

/** "Continue with Google" posts here; staff go on to Google's consent screen. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const field = form?.get("next");
  const next = sameSiteNextPath(typeof field === "string" ? field : undefined, ROUTES.scouting);
  const started = await startGoogleSignIn(adminApiUrl(), await adminHeaders());
  if (!started.ok) return seeOther(signInErrorPath(ROUTES.signIn, started.error, next));
  (await cookies()).set(
    GOOGLE_STATE_COOKIE,
    encodeGoogleState({ state: started.state, next }),
    googleStateCookie(process.env.NODE_ENV === "production", GOOGLE_AUTH_ROUTE),
  );
  return seeOther(started.url);
}
