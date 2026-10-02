import { cookies } from "next/headers";
import {
  GOOGLE_STATE_COOKIE,
  encodeGoogleState,
  googleStateCookie,
  seeOther,
  signInErrorPath,
  startGoogleSignIn,
} from "@joined/google-signin";
import { scoutwellApiUrl } from "@/lib/config";
import { ROUTES, safeNextPath } from "@/lib/routes";

/** "Continue with Google" posts here; the scout goes on to Google's consent screen. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const field = form?.get("next");
  const next = safeNextPath(typeof field === "string" ? field : undefined);
  const started = await startGoogleSignIn(scoutwellApiUrl());
  if (!started.ok) return seeOther(signInErrorPath(ROUTES.signIn, started.error, next));
  (await cookies()).set(
    GOOGLE_STATE_COOKIE,
    encodeGoogleState({ state: started.state, next }),
    googleStateCookie(process.env.NODE_ENV === "production"),
  );
  return seeOther(started.url);
}
