/**
 * Where an app serves its Google routes: the start route posts here, Google redirects
 * to `<route>/callback`, and the state cookie is scoped to the route. Each app's OAuth
 * client registers `<app origin><route>/callback` in Google Cloud.
 */
/** Joined's routes. */
export const GOOGLE_SIGNIN_ROUTE = "/api/auth/google";
/** Scoutwell's and Admin's routes. */
export const GOOGLE_AUTH_ROUTE = "/auth/google";
/** Joined's callback. */
export const GOOGLE_CALLBACK_ROUTE = googleCallbackRoute(GOOGLE_SIGNIN_ROUTE);

/** The page Google redirects back to for an app serving its routes at route. */
export function googleCallbackRoute(route: string): string {
  return `${route}/callback`;
}
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
 * the callback route reads it. route is where the app serves its Google routes.
 */
export function googleStateCookie(secure: boolean, route: string = GOOGLE_SIGNIN_ROUTE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: route,
    maxAge: GOOGLE_STATE_MAX_AGE_SECONDS,
  };
}

/**
 * Where to send someone after sign-in: a path on this site, or fallback. Browsers
 * read "/\" like "//", another host, so both are refused.
 */
export function sameSiteNextPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
