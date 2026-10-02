import { GOOGLE_ERROR_PARAM, type GoogleSignInError } from "./messages";
import { decodeGoogleState } from "./state";

const START_PATH = "/v1/auth/google/start";

/** The sign-up form field naming the kind of account to create. */
export const GOOGLE_MODE_FIELD = "mode";
const CALLBACK_PATH = "/v1/auth/google/callback";

export type GoogleStarted =
  { ok: true; url: string; state: string } | { ok: false; error: GoogleSignInError };

export type GoogleFinished =
  { ok: true; token: string; next: string } | { ok: false; error: GoogleSignInError; next: string };

export type GoogleStartOptions = {
  /** Sent with the call, for an API that wants its own credentials. */
  headers?: Record<string, string>;
  /** The kind of account to create if the person is new, e.g. "employee". */
  mode?: string;
};

/** Asks the app's API where to send the browser, and for the state to remember. */
export async function startGoogleSignIn(
  apiUrl: string,
  { headers = {}, mode = "" }: GoogleStartOptions = {},
): Promise<GoogleStarted> {
  try {
    const response = await fetch(new URL(START_PATH, `${apiUrl}/`), {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(mode ? { mode } : {}),
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, error: errorFor(response.status) };
    const { url, state } = (await response.json()) as { url: string; state: string };
    return { ok: true, url, state };
  } catch {
    return { ok: false, error: "failed" };
  }
}

/**
 * Checks Google's redirect against the state cookie, then trades the code for a
 * session token. `next` is where the person was headed, from the cookie.
 */
export async function finishGoogleSignIn(
  apiUrl: string,
  callback: URL,
  cookie: string | undefined,
  headers: Record<string, string> = {},
): Promise<GoogleFinished> {
  const saved = decodeGoogleState(cookie);
  const next = saved?.next ?? "";
  const params = callback.searchParams;
  if (params.has("error")) {
    return {
      ok: false,
      error: params.get("error") === "access_denied" ? "cancelled" : "failed",
      next,
    };
  }
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !saved || saved.state !== state) {
    return { ok: false, error: "expired", next };
  }
  try {
    const response = await fetch(new URL(CALLBACK_PATH, `${apiUrl}/`), {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, error: errorFor(response.status), next };
    const { token } = (await response.json()) as { token?: string };
    return token ? { ok: true, token, next } : { ok: false, error: "failed", next };
  } catch {
    return { ok: false, error: "failed", next };
  }
}

function errorFor(status: number): GoogleSignInError {
  switch (status) {
    case 400:
      return "expired";
    case 403:
    case 409:
      return "wrong_account";
    case 503:
      return "unavailable";
    default:
      return "failed";
  }
}

/** The sign-in page showing why Google sign-in stopped, keeping where they were headed. */
export function signInErrorPath(
  signInPath: string,
  error: GoogleSignInError,
  next: string,
): string {
  const query = new URLSearchParams({ [GOOGLE_ERROR_PARAM]: error });
  if (next) query.set("next", next);
  return `${signInPath}?${query}`;
}

/** A 303, so the browser follows with a GET whatever method brought it here. */
export function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}
