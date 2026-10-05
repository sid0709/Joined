import {
  DEV_API_HOST,
  DEV_WEB_ORIGIN,
  PRODUCTION_API_HOST,
  PRODUCTION_WEB_ORIGIN,
  resolveHost,
} from "./hosts";

const SESSION_COOKIE_NAME = "scoutwell_session";

export function getApiHost(): string {
  return resolveHost(
    import.meta.env.VITE_SCOUT_API_HOST,
    import.meta.env.MODE,
    PRODUCTION_API_HOST,
    DEV_API_HOST,
  );
}

export function getWebOrigin(): string {
  return resolveHost(
    import.meta.env.VITE_SCOUTWELL_WEB_ORIGIN,
    import.meta.env.MODE,
    PRODUCTION_WEB_ORIGIN,
    DEV_WEB_ORIGIN,
  );
}

export function getSignInUrl(): string {
  return `${getWebOrigin()}/sign-in`;
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}
