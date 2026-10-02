/** Oak's own API (the Go backend). Override per build with VITE_OAK_API_URL. */
export const DEFAULT_ATHENS_API_URL =
  import.meta.env.VITE_OAK_API_URL?.trim() || "http://127.0.0.1:8980";
export const OAK_SOCKET_PATH = "/oak";

/**
 * Oak has no accounts. It signs in with the Joined session: the token
 * joined-frontend keeps in this cookie, which joined-backend and Oak's backend
 * both accept as a bearer token.
 */
export const JOINED_SESSION_COOKIE = "joined_session";
/** Where joined-frontend runs. Override per build with VITE_JOINED_URL. */
export const DEFAULT_JOINED_URL =
  import.meta.env.VITE_JOINED_URL?.trim() || "http://localhost:3002";

export type OakStoredSession = {
  accessToken: string;
  username: string;
  displayName: string;
  profileId: string;
  expiresAt: string;
};

const STORAGE_KEYS = {
  apiUrl: "athensApiUrl",
  session: "oakSession",
  signedOutToken: "oakSignedOutToken",
} as const;

export async function getAthensApiUrl(): Promise<string> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.apiUrl]);
  const value = stored[STORAGE_KEYS.apiUrl];
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\/$/, "")
    : DEFAULT_ATHENS_API_URL;
}

/** Socket.io origin. Sign-in uses `/api/oak`; the engine path is `/oak` on the host. */
export function athensSocketOrigin(apiUrl: string): string {
  return apiUrl
    .trim()
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");
}

export async function setAthensApiUrl(url: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.apiUrl]: url.trim().replace(/\/$/, ""),
  });
}

export async function getOakSession(): Promise<OakStoredSession | null> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.session]);
  const session = stored[STORAGE_KEYS.session] as OakStoredSession | undefined;
  if (!session?.accessToken) return null;
  if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) {
    await clearOakSession();
    return null;
  }
  return session;
}

export async function setOakSession(session: OakStoredSession): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.session]: session });
}

export async function clearOakSession(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEYS.session]);
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getOakSession();
  return session?.accessToken ?? null;
}

export type OakAuthResult = { ok: true; session: OakStoredSession } | { ok: false; error: string };

export const JOINED_SIGN_IN_REQUIRED = "Sign in to Joined in this browser first, then try again.";

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
 * Make Oak's session the Joined session. Reads the Joined cookie and asks Oak's
 * backend who it belongs to. With `force`, Oak signs back in even after the
 * person signed out of Oak on this Joined session.
 */
export async function syncJoinedSession(
  options: { apiUrl?: string; force?: boolean } = {},
): Promise<OakAuthResult> {
  const base = (options.apiUrl || (await getAthensApiUrl())).replace(/\/$/, "");
  const token = await readJoinedToken();
  if (!token) {
    await clearOakSession();
    return { ok: false, error: JOINED_SIGN_IN_REQUIRED };
  }
  if (!options.force && token === (await ownSignedOutToken())) {
    return { ok: false, error: "Signed out of Oak." };
  }
  try {
    const res = await fetch(`${base}/api/oak/auth/me`, {
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
      await clearOakSession();
      return { ok: false, error: JOINED_SIGN_IN_REQUIRED };
    }
    if (!res.ok || !data.session) {
      return {
        ok: false,
        error: data.message || "Joined account is not a job hunter account.",
      };
    }
    const session: OakStoredSession = {
      accessToken: token,
      username: data.session.username || "",
      displayName: data.session.displayName || data.session.username || "Joined",
      profileId: data.session.profileId || "",
      // The session lives as long as the Joined cookie; the backend rejects it when it ends.
      expiresAt: "",
    };
    await setAthensApiUrl(base);
    await chrome.storage.local.remove([STORAGE_KEYS.signedOutToken]);
    await setOakSession(session);
    return { ok: true, session };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err ?? "");
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      return {
        ok: false,
        error: "Couldn’t reach Oak. Check the API URL and that the backend is running.",
      };
    }
    return { ok: false, error: message || "Couldn’t sign in." };
  }
}

/** Sign in with the Joined session already in this browser. */
export function oakSignIn(apiUrl?: string): Promise<OakAuthResult> {
  return syncJoinedSession({ apiUrl, force: true });
}

/**
 * Forget the session in Oak only. The Joined session is shared with joined-frontend,
 * so it stays; Oak will not sign back in on it until the person asks to.
 */
export async function oakSignOut(): Promise<void> {
  const token = await getAccessToken();
  if (token) {
    await chrome.storage.local.set({ [STORAGE_KEYS.signedOutToken]: token });
  }
  await clearOakSession();
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
