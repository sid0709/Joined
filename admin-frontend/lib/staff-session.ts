/** Staff session facts, free of server-only imports so `proxy.ts` can read them too. */
export const STAFF_SESSION_COOKIE = "joined_admin_session";
/** Matches the admin API's staff session lifetime. */
export const STAFF_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
/** The admin API reads the staff session from this header, beside the admin token. */
export const STAFF_SESSION_HEADER = "X-Admin-Session";
/** `proxy.ts` hands the requested path to the console layout, for the way back from sign-in. */
export const REQUEST_PATH_HEADER = "x-admin-path";

export const STAFF_SESSION_PATH = "/v1/auth/session";
export const STAFF_SIGNOUT_PATH = "/v1/auth/signout";

export type Staff = { email: string; name: string };

/** GET /v1/auth/session: whether the console needs sign-in, and who is signed in. */
export type StaffSession = { required: boolean; staff: Staff | null };
