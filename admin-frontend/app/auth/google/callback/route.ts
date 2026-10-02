import { cookies } from "next/headers";
import {
  GOOGLE_AUTH_ROUTE,
  GOOGLE_STATE_COOKIE,
  finishGoogleSignIn,
  googleStateCookie,
  sameSiteNextPath,
  seeOther,
  signInErrorPath,
} from "@joined/google-signin";
import { ROUTES } from "@/lib/nav";
import { adminApiUrl, adminHeaders } from "@/lib/server/env";
import { writeStaffSession } from "@/lib/server/staff-session";

/** Google sends the staff member back here with a code to trade for a session. */
export async function GET(request: Request) {
  const jar = await cookies();
  const result = await finishGoogleSignIn(
    adminApiUrl(),
    new URL(request.url),
    jar.get(GOOGLE_STATE_COOKIE)?.value,
    await adminHeaders(),
  );
  jar.set(GOOGLE_STATE_COOKIE, "", {
    ...googleStateCookie(process.env.NODE_ENV === "production", GOOGLE_AUTH_ROUTE),
    maxAge: 0,
  });
  const next = sameSiteNextPath(result.next, ROUTES.scouting);
  if (!result.ok) return seeOther(signInErrorPath(ROUTES.signIn, result.error, next));
  await writeStaffSession(result.token);
  return seeOther(next);
}
