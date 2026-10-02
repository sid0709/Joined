import { cookies } from "next/headers";
import { STAFF_SESSION_COOKIE, STAFF_SESSION_MAX_AGE_SECONDS } from "@/lib/staff-session";

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** The signed-in staff member's session token, or "". */
export async function staffToken() {
  return (await cookies()).get(STAFF_SESSION_COOKIE)?.value ?? "";
}

export async function writeStaffSession(token: string) {
  (await cookies()).set(STAFF_SESSION_COOKIE, token, cookieOptions(STAFF_SESSION_MAX_AGE_SECONDS));
}

export async function clearStaffSession() {
  (await cookies()).set(STAFF_SESSION_COOKIE, "", cookieOptions(0));
}
