import { ACORN_SOCKET_PATH, acornHosts } from "@acorn/shared/api";

const hosts = acornHosts(import.meta.env.MODE);

/** Acorn's API: backend-core's server. Override per build with VITE_ACORN_API_URL. */
export const DEFAULT_JOINED_API_URL = import.meta.env.VITE_ACORN_API_URL?.trim() || hosts.api;
export { ACORN_SOCKET_PATH };

/**
 * Acorn has no accounts. It signs in with the Joined session: the token
 * joined-frontend keeps in this cookie, which joined-backend and backend-core
 * both accept as a bearer token.
 */
export const JOINED_SESSION_COOKIE = "joined_session";
/** Where joined-frontend runs. Override per build with VITE_JOINED_URL. */
export const DEFAULT_JOINED_URL = import.meta.env.VITE_JOINED_URL?.trim() || hosts.joined;

export type AcornStoredSession = {
  accessToken: string;
  username: string;
  displayName: string;
  profileId: string;
  expiresAt: string;
};

const STORAGE_KEYS = {
  apiUrl: "joinedApiUrl",
  session: "acornSession",
  signedOutToken: "acornSignedOutToken",
} as const;

export async function getJoinedApiUrl(): Promise<string> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.apiUrl]);
  const value = stored[STORAGE_KEYS.apiUrl];
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\/$/, "")
    : DEFAULT_JOINED_API_URL;
}

/** Socket.io origin: the API host. Routes and the engine path both sit under `/acorn` there. */
export function joinedSocketOrigin(apiUrl: string): string {
  return apiUrl
    .trim()
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");
}

export async function setJoinedApiUrl(url: string): Promise<void> {
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

export const JOINED_SIGN_IN_REQUIRED = "Sign in to Joined in this browser first, then try again.";
/** The Joined cookie is there, but Acorn's backend doesn't know the session behind it. */
export const JOINED_SESSION_REJECTED =
  "Acorn didn’t accept your Joined session. Sign in to Joined again, then try again.";

/** The Joined session token in the browser's cookie jar, or null when signed out of Joined. */
async function readJoinedToken(): Promise<string | null> {
  const cookie = await chrome.cookies.get({
    url: DEFAULT_JOINED_URL,
    name: JOINED_SESSION_COOKIE,
  });
  return cookie?.value?.trim() || null;
}

async function ownSignedOutToken(): Promise<string | null> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.signedOutToken]);
  const value = stored[STORAGE_KEYS.signedOutToken];
  return typeof value === "string" && value ? value : null;
}

/**
 * Make Acorn's session the Joined session. Reads the Joined cookie and asks Acorn's
 * backend who it belongs to. With `force`, Acorn signs back in even after the
 * person signed out of Acorn on this Joined session.
 */
export async function syncJoinedSession(
  options: { apiUrl?: string; force?: boolean } = {},
): Promise<AcornAuthResult> {
  const base = (options.apiUrl || (await getJoinedApiUrl())).replace(/\/$/, "");
  const token = await readJoinedToken();
  if (!token) {
    await clearAcornSession();
    return { ok: false, error: JOINED_SIGN_IN_REQUIRED };
  }
  if (!options.force && token === (await ownSignedOutToken())) {
    return { ok: false, error: "Signed out of Acorn." };
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
      return { ok: false, error: JOINED_SESSION_REJECTED };
    }
    if (!res.ok || !data.session) {
      return {
        ok: false,
        error: data.message || "Joined account is not a job hunter account.",
      };
    }
    const session: AcornStoredSession = {
      accessToken: token,
      username: data.session.username || "",
      displayName: data.session.displayName || data.session.username || "Joined",
      profileId: data.session.profileId || "",
      // The session lives as long as the Joined cookie; the backend rejects it when it ends.
      expiresAt: "",
    };
    await setJoinedApiUrl(base);
    await chrome.storage.local.remove([STORAGE_KEYS.signedOutToken]);
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

/** Sign in with the Joined session already in this browser. */
export function acornSignIn(apiUrl?: string): Promise<AcornAuthResult> {
  return syncJoinedSession({ apiUrl, force: true });
}

/**
 * Forget the session in Acorn only. The Joined session is shared with joined-frontend,
 * so it stays; Acorn will not sign back in on it until the person asks to.
 */
export async function acornSignOut(): Promise<void> {
  const token = await getAccessToken();
  if (token) {
    await chrome.storage.local.set({ [STORAGE_KEYS.signedOutToken]: token });
  }
  await clearAcornSession();
}

/** True for a change to the Joined session cookie. */
export function isJoinedSessionCookie(cookie: chrome.cookies.Cookie): boolean {
  return (
    cookie.name === JOINED_SESSION_COOKIE &&
    DEFAULT_JOINED_URL.includes(cookie.domain.replace(/^\./, ""))
  );
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (!token) throw new Error("Sign in to Joined required");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}
