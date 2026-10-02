import { seeOther } from "@joined/google-signin";
import { ROUTES } from "@/lib/nav";
import { adminApiUrl, adminHeaders } from "@/lib/server/env";
import { clearStaffSession } from "@/lib/server/staff-session";
import { STAFF_SIGNOUT_PATH } from "@/lib/staff-session";

/** Ends the staff session on the API and in this browser, then shows sign-in. */
export async function POST() {
  await fetch(`${adminApiUrl()}${STAFF_SIGNOUT_PATH}`, {
    method: "POST",
    headers: await adminHeaders(),
    cache: "no-store",
  }).catch(() => null);
  await clearStaffSession();
  return seeOther(ROUTES.signIn);
}
