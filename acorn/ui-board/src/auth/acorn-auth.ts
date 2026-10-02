import { BASH_SOCKET_PATH, bashHosts } from "@bash/shared/api";

/** Bash's API: backend-core's server. Override per build with VITE_BASH_API_URL. */
export const DEFAULT_ATHENS_API_URL =
  import.meta.env.VITE_BASH_API_URL?.trim() || bashHosts(import.meta.env.MODE).api;
export { BASH_SOCKET_PATH };

export type BashStoredSession = {
  accessToken: string;
  username: string;
  displayName: string;
  profileId: string;
  expiresAt: string;
};

const API_URL_KEY = "bash.athensApiUrl";
const SESSION_KEY = "bash.session";

export function getAthensApiUrl(): string {
  const stored = localStorage.getItem(API_URL_KEY);
  return (stored || DEFAULT_ATHENS_API_URL).replace(/\/$/, "");
}

export function setAthensApiUrl(url: string): void {
  localStorage.setItem(API_URL_KEY, url.trim().replace(/\/$/, ""));
}

export function getBashSession(): BashStoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as BashStoredSession;
    if (!session?.accessToken) return null;
    if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) {
      clearBashSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setBashSession(session: BashStoredSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearBashSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getAccessToken(): string | null {
  return getBashSession()?.accessToken ?? null;
}

export async function bashSignIn(
  name: string,
  password: string,
  apiUrl = getAthensApiUrl(),
): Promise<BashStoredSession> {
  const base = apiUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/bash/auth/signin`, {
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
  const session: BashStoredSession = {
    accessToken: data.session.accessToken,
    username: data.session.username || name,
    displayName: data.session.displayName || data.session.username || name,
    profileId: data.session.profileId || "",
    expiresAt: data.session.expiresAt || "",
  };
  setAthensApiUrl(base);
  setBashSession(session);
  return session;
}

export async function bashSignOut(): Promise<void> {
  const base = getAthensApiUrl();
  const token = getAccessToken();
  if (token) {
    try {
      await fetch(`${base}/bash/auth/signout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* ignore */
    }
  }
  clearBashSession();
}

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  if (!token) throw new Error("Sign in to Athens required");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}
