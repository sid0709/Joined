export const DEFAULT_ATHENS_API_URL =
  import.meta.env.VITE_ATHENS_API_URL || "https://athensai.remotepairnet.net";
export const OAK_SOCKET_PATH = "/oak";

export type OakStoredSession = {
  accessToken: string;
  username: string;
  displayName: string;
  profileId: string;
  expiresAt: string;
};

const API_URL_KEY = "oak.athensApiUrl";
const SESSION_KEY = "oak.session";

export function getAthensApiUrl(): string {
  const stored = localStorage.getItem(API_URL_KEY);
  return (stored || DEFAULT_ATHENS_API_URL).replace(/\/$/, "");
}

export function setAthensApiUrl(url: string): void {
  localStorage.setItem(API_URL_KEY, url.trim().replace(/\/$/, ""));
}

export function getOakSession(): OakStoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as OakStoredSession;
    if (!session?.accessToken) return null;
    if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) {
      clearOakSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setOakSession(session: OakStoredSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearOakSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getAccessToken(): string | null {
  return getOakSession()?.accessToken ?? null;
}

export async function oakSignIn(
  name: string,
  password: string,
  apiUrl = getAthensApiUrl(),
): Promise<OakStoredSession> {
  const base = apiUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/api/oak/auth/signin`, {
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
  const session: OakStoredSession = {
    accessToken: data.session.accessToken,
    username: data.session.username || name,
    displayName: data.session.displayName || data.session.username || name,
    profileId: data.session.profileId || "",
    expiresAt: data.session.expiresAt || "",
  };
  setAthensApiUrl(base);
  setOakSession(session);
  return session;
}

export async function oakSignOut(): Promise<void> {
  const base = getAthensApiUrl();
  const token = getAccessToken();
  if (token) {
    try {
      await fetch(`${base}/api/oak/auth/signout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* ignore */
    }
  }
  clearOakSession();
}

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  if (!token) throw new Error("Sign in to Athens required");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}
