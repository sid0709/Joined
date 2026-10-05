const DEFAULT_API_HOST = "http://127.0.0.1:8082";
const DEFAULT_WEB_ORIGIN = "http://localhost:6003";
const SESSION_COOKIE_NAME = "scoutwell_session";

export function getApiHost(): string {
  return import.meta.env.VITE_SCOUT_API_HOST || DEFAULT_API_HOST;
}

export function getWebOrigin(): string {
  return import.meta.env.VITE_SCOUTWELL_WEB_ORIGIN || DEFAULT_WEB_ORIGIN;
}

export function getSignInUrl(): string {
  return `${getWebOrigin()}/sign-in`;
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}
