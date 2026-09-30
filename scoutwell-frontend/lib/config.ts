export const BRAND = "Scoutwell";
export const LOCALE = "en-US";

/** Wait this long after typing stops before checking a link. */
export const PRECHECK_DELAY_MS = 600;
/** How often a page refreshes while a submission is still being checked. */
export const STATUS_POLL_MS = 2000;
/** Items per page on the lists the scout pages through. */
export const PAGE_LIMIT = 20;
/** Rows shown in the dashboard's recent lists. */
export const RECENT_LIMIT = 5;

/** The Opened API, called from the server only. */
export function openedApiUrl(): string {
  const url = process.env.OPENED_API_URL;
  if (!url) {
    throw new Error("OPENED_API_URL is not set");
  }
  return url.replace(/\/$/, "");
}

/** The API base partners call directly, shown in the developer docs. */
export function publicApiUrl(): string {
  return (process.env.SCOUT_PUBLIC_API_URL || openedApiUrl()).replace(/\/$/, "");
}

/** Opened's public site, for "view live job" links. Optional. */
export function openedWebUrl(): string {
  return (process.env.OPENED_WEB_URL ?? "").replace(/\/$/, "");
}

/** Remembers whether the side rail is collapsed, so the server can render it that way first. */
export const RAIL_COOKIE = "scout-rail";
export const RAIL_COOKIE_VALUE_COLLAPSED = "collapsed";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
export const RAIL_COOKIE_MAX_AGE = ONE_YEAR_SECONDS;
