import { ACORN_SESSION_COOKIE, ACORN_SOCKET_PATH, acornHosts } from "@acorn/shared/api";

const hosts = acornHosts(import.meta.env.MODE);

/** Acorn's API. Override per build with VITE_ACORN_API_URL. */
export const DEFAULT_ACORN_API_URL = import.meta.env.VITE_ACORN_API_URL?.trim() || hosts.api;
export { ACORN_SOCKET_PATH };

/** Where acorn-frontend runs. Override per build with VITE_ACORN_WEB_URL. */
export const DEFAULT_ACORN_WEB_URL = import.meta.env.VITE_ACORN_WEB_URL?.trim() || hosts.web;

export type AcornStoredSession = {
  accessToken: string;
  username: string;
  displayName: string;
  profileId: string;
  expiresAt: string;
};

const STORAGE_KEYS = {
  apiUrl: "acornApiUrl",
  session: "acornSession",
} as const;

export async function getAcornApiUrl(): Promise<string> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.apiUrl]);
  const value = stored[STORAGE_KEYS.apiUrl];
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\/$/, "")
    : DEFAULT_ACORN_API_URL;
}

/** Socket.io origin: the API host. Routes and the engine path both sit under `/acorn` there. */
export function acornSocketOrigin(apiUrl: string): string {
  return apiUrl
    .trim()
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");
}

export async function setAcornApiUrl(url: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.apiUrl]: url.trim().replace(/\/$/, ""),
  });
}

export async function getAcornSession(): Promise<AcornStoredSession | null> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.session]);
  const session = stored[STORAGE_KEYS.session] as AcornStoredSession | undefined;
  if (!session?.accessToken) return null;
  if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) {
    await clearAcornSession();
    return null;
  }
  return session;
}

export async function setAcornSession(session: AcornStoredSession): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.session]: session });
}

export async function clearAcornSession(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEYS.session]);
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getAcornSession();
  return session?.accessToken ?? null;
}

export type AcornAuthResult =
  { ok: true; session: AcornStoredSession } | { ok: false; error: string };

export const ACORN_SIGN_IN_REQUIRED = "Sign in on the Acorn site in this browser, then try again.";
export const ACORN_SESSION_REJECTED =
  "Acorn didn’t accept that sign-in. Sign in on the Acorn site again, then try again.";

/** The Acorn session token in the browser's cookie jar, or null when signed out. */
async function readAcornToken(): Promise<string | null> {
  const cookie = await chrome.cookies.get({
    url: DEFAULT_ACORN_WEB_URL,
    name: ACORN_SESSION_COOKIE,
  });
  return cookie?.value?.trim() || null;
}

/**
 * Make the extension's session the acorn-frontend cookie. Reads that cookie and
 * asks Acorn's API who it belongs to.
 */
export async function syncAcornSession(
  options: { apiUrl?: string } = {},
): Promise<AcornAuthResult> {
  const base = (options.apiUrl || (await getAcornApiUrl())).replace(/\/$/, "");
  const token = await readAcornToken();
  if (!token) {
    await clearAcornSession();
    return { ok: false, error: ACORN_SIGN_IN_REQUIRED };
  }
  try {
    const res = await fetch(`${base}/acorn/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as {
      message?: string;
      session?: {
        username?: string;
        displayName?: string;
        profileId?: string;
      };
    };
    if (res.status === 401) {
      await clearAcornSession();
      return { ok: false, error: ACORN_SESSION_REJECTED };
    }
    if (!res.ok || !data.session) {
      return { ok: false, error: data.message || "Couldn’t sign in." };
    }
    const session: AcornStoredSession = {
      accessToken: token,
      username: data.session.username || "",
      displayName: data.session.displayName || data.session.username || "Acorn",
      profileId: data.session.profileId || "",
      expiresAt: "",
    };
    await setAcornApiUrl(base);
    await setAcornSession(session);
    return { ok: true, session };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err ?? "");
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      return {
        ok: false,
        error: "Couldn’t reach Acorn. Check the API URL and that the backend is running.",
      };
    }
    return { ok: false, error: message || "Couldn’t sign in." };
  }
}

/** Sign in with the Acorn session already in this browser. */
export function acornSignIn(apiUrl?: string): Promise<AcornAuthResult> {
  return syncAcornSession({ apiUrl });
}

/** End the shared Acorn session: the API, the site cookie, and this extension. */
export async function acornSignOut(): Promise<void> {
  const token = await getAccessToken();
  const base = await getAcornApiUrl();
  if (token) {
    await fetch(`${base}/acorn/auth/signout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
  await chrome.cookies.remove({ url: DEFAULT_ACORN_WEB_URL, name: ACORN_SESSION_COOKIE });
  await clearAcornSession();
}

/** True for a change to the Acorn session cookie on acorn-frontend. */
export function isAcornSessionCookie(cookie: chrome.cookies.Cookie): boolean {
  return (
    cookie.name === ACORN_SESSION_COOKIE &&
    DEFAULT_ACORN_WEB_URL.includes(cookie.domain.replace(/^\./, ""))
  );
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (!token) throw new Error("Sign in to Acorn required");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}
