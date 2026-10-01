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

/** The Joined API, called from the server only. */
export function joinedApiUrl(): string {
  const url = process.env.JOINED_API_URL;
  if (!url) {
    throw new Error("JOINED_API_URL is not set");
  }
  return url.replace(/\/$/, "");
}

/** The API base partners call directly, shown in the developer docs. */
export function publicApiUrl(): string {
  return (process.env.SCOUT_PUBLIC_API_URL || joinedApiUrl()).replace(/\/$/, "");
}

/** Joined's public site, for "view live job" links. Optional. */
export function joinedWebUrl(): string {
  return (process.env.JOINED_WEB_URL ?? "").replace(/\/$/, "");
}

/** Written by the theme toggle; the server reads it so a dark scout never sees a light flash. */
export const THEME_COOKIE = "joined-theme";
