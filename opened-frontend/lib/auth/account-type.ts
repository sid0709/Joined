import type { WorkspaceMode } from "@/lib/routes";
import type { AuthSession } from "./types";

/**
 * Which app an account uses. An employee account is linked to a company and
 * lives in the hiring workspace; a candidate account uses job search. The two
 * never mix: employees don't see Find jobs or My applications, candidates don't
 * see the hiring tools.
 */
export function workspaceOf(session: AuthSession | null): WorkspaceMode {
  return session?.company ? "company" : "hunter";
}

export function isEmployee(session: AuthSession | null): session is AuthSession {
  return workspaceOf(session) === "company";
}
