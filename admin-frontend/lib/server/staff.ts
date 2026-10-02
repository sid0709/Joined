import { ApiError } from "@joined/scout";
import { STAFF_SESSION_PATH, type Staff, type StaffSession } from "@/lib/staff-session";
import { adminGet } from "./api";

/**
 * Where this browser stands with the admin API:
 * - signed-in: a live staff session.
 * - signed-out: no session, or it expired.
 * - not-set-up: the API has no Google client, so nobody can sign in.
 * - unreachable: the API did not answer, so nothing can be checked.
 */
export type StaffAccess =
  | { status: "signed-in"; staff: Staff }
  | { status: "signed-out" }
  | { status: "not-set-up" }
  | { status: "unreachable" };

/** Never throws: a page decides what to show for each status. */
export async function loadStaffAccess(): Promise<StaffAccess> {
  try {
    const session = await adminGet<StaffSession>(STAFF_SESSION_PATH);
    if (!session.required) return { status: "not-set-up" };
    return session.staff ? { status: "signed-in", staff: session.staff } : { status: "signed-out" };
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) return { status: "signed-out" };
    return { status: "unreachable" };
  }
}
