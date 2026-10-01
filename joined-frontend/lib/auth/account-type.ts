import type { WorkspaceMode } from "@/lib/routes";
import type { AuthSession } from "./types";

/**
 * Which Joined workspace an account uses. A recruiter is linked to a company
 * and lives in the hiring workspace. A job hunter uses job search. A scout
 * account signs in on Scoutwell and is refused here.
 */
export function workspaceOf(session: AuthSession | null): WorkspaceMode {
  return session?.company ? "company" : "hunter";
}

export function isEmployee(session: AuthSession | null): session is AuthSession {
  return workspaceOf(session) === "company";
}
