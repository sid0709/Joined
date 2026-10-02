import { ACORN_SOCKET_PATH, acornHosts } from "@acorn/shared/api";

/** Acorn's API: backend-core's server. Override per build with VITE_ACORN_API_URL. */
export const DEFAULT_JOINED_API_URL =
  import.meta.env.VITE_ACORN_API_URL?.trim() || acornHosts(import.meta.env.MODE).api;
export { ACORN_SOCKET_PATH };

export type AcornStoredSession = {
  accessToken: string;
  username: string;
  displayName: string;
  profileId: string;
  expiresAt: string;
};

const API_URL_KEY = "acorn.joinedApiUrl";
const SESSION_KEY = "acorn.session";

export function getJoinedApiUrl(): string {
  const stored = localStorage.getItem(API_URL_KEY);
  return (stored || DEFAULT_JOINED_API_URL).replace(/\/$/, "");
}

export function setJoinedApiUrl(url: string): void {
  localStorage.setItem(API_URL_KEY, url.trim().replace(/\/$/, ""));
}

export function getAcornSession(): AcornStoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AcornStoredSession;
    if (!session?.accessToken) return null;
    if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) {
      clearAcornSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setAcornSession(session: AcornStoredSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearAcornSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getAccessToken(): string | null {
  return getAcornSession()?.accessToken ?? null;
}

export async function acornSignIn(
  name: string,
  password: string,
  apiUrl = getJoinedApiUrl(),
): Promise<AcornStoredSession> {
  const base = apiUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/acorn/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, password }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    session?: {
      accessToken?: string;
      username?: string;
      displayName?: string;
      profileId?: string;
      expiresAt?: string;
    };
  };
  if (!res.ok || !data.session?.accessToken) {
    throw new Error(data.message || `Sign in failed (${res.status})`);
  }
  const session: AcornStoredSession = {
    accessToken: data.session.accessToken,
    username: data.session.username || name,
    displayName: data.session.displayName || data.session.username || name,
    profileId: data.session.profileId || "",
    expiresAt: data.session.expiresAt || "",
  };
  setJoinedApiUrl(base);
  setAcornSession(session);
  return session;
}

export async function acornSignOut(): Promise<void> {
  const base = getJoinedApiUrl();
  const token = getAccessToken();
  if (token) {
    try {
      await fetch(`${base}/acorn/auth/signout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* ignore */
    }
  }
  clearAcornSession();
}

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  if (!token) throw new Error("Sign in to Joined required");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}
