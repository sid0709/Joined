import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./constants";

/**
 * True when the browser sent the Joined session cookie. This app does not call
 * an auth API; later pages can load the real session the same way Joined does.
 */
export async function hasJoinedSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return Boolean(token?.trim());
}
