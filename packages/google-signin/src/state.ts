/** Where every app serves its Google routes; the state cookie is scoped to them. */
export const GOOGLE_SIGNIN_ROUTE = "/api/auth/google";
/** Google redirects here. Register `<app origin>/api/auth/google/callback` in Google Cloud. */
export const GOOGLE_CALLBACK_ROUTE = `${GOOGLE_SIGNIN_ROUTE}/callback`;
/** Ties Google's redirect back to the browser that started the sign-in. */
export const GOOGLE_STATE_COOKIE = "google_signin_state";
/** As long as the API keeps the state, so the cookie never outlives it. */
export const GOOGLE_STATE_MAX_AGE_SECONDS = 10 * 60;

/** What the browser keeps while it is away on Google's consent screen. */
export type GoogleState = { state: string; next: string };

export function encodeGoogleState({ state, next }: GoogleState): string {
  return `${state}.${encodeURIComponent(next)}`;
}

export function decodeGoogleState(value: string | undefined): GoogleState | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  try {
    return { state: value.slice(0, dot), next: decodeURIComponent(value.slice(dot + 1)) };
  } catch {
    return null;
  }
}

/**
 * Lax so it survives Google's top-level redirect back; httpOnly because only
 * the callback route reads it.
 */
export function googleStateCookie(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: GOOGLE_SIGNIN_ROUTE,
    maxAge: GOOGLE_STATE_MAX_AGE_SECONDS,
  };
}
