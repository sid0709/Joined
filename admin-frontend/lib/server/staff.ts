import { ApiError } from "@joined/scout";
import { STAFF_SESSION_PATH, type StaffSession } from "@/lib/staff-session";
import { adminGet } from "./api";

/**
 * The staff session, or null when sign-in is required and nobody is signed in.
 * When the API does not require sign-in, staff is null but the console is open.
 */
export async function loadStaffSession(): Promise<StaffSession | null> {
  try {
    return await adminGet<StaffSession>(STAFF_SESSION_PATH);
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) return null;
    throw cause;
  }
}
