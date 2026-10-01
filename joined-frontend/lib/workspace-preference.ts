import { ROUTES, type WorkspaceMode } from "./routes";

/**
 * The last mode someone chose — candidate ("hunter") or employer ("company").
 * A cookie rather than localStorage so `proxy.ts` can read it and route "/" on the
 * server with no flash. Stands in for `users.last_active_mode` until accounts exist.
 */
export const MODE_COOKIE = "joined_mode";
const MODE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Where each mode lands. */
export const MODE_HOME: Record<WorkspaceMode, string> = {
  hunter: ROUTES.search,
  company: ROUTES.company,
};

export function parseWorkspaceMode(value: string | undefined | null): WorkspaceMode | null {
  return value === "hunter" || value === "company" ? value : null;
}

export function readStoredWorkspaceMode(): WorkspaceMode | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${MODE_COOKIE}=`));
  return parseWorkspaceMode(match?.slice(MODE_COOKIE.length + 1));
}

export function writeStoredWorkspaceMode(mode: WorkspaceMode) {
  document.cookie = `${MODE_COOKIE}=${mode}; path=/; max-age=${MODE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

/** For useSyncExternalStore: the preference never changes out from under a mounted picker. */
export function subscribeToWorkspaceMode() {
  return () => {};
}

/**
 * Unresolved during SSR and the first client render — distinct from `null` ("we checked;
 * nothing stored"). Treating it as "already chosen" for that one render keeps returning
 * visitors from ever seeing the picker flash open before it reads the real value.
 */
export const UNRESOLVED_WORKSPACE_MODE = "unresolved" as const;

export function getServerWorkspaceMode() {
  return UNRESOLVED_WORKSPACE_MODE;
}
