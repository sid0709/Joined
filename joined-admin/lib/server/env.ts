/**
 * Server-only settings. The admin token never reaches the browser: pages read
 * the API from the server, and browser calls go through /api/admin.
 */

/** The admin API (admin-backend). */
export function adminApiUrl(): string {
  const url = process.env.ADMIN_API_URL;
  if (!url) {
    throw new Error("ADMIN_API_URL is not set");
  }
  return url.replace(/\/$/, "");
}

/** Bearer token the API requires on staff endpoints when ADMIN_API_TOKEN is set there. */
export function adminApiToken(): string {
  return process.env.ADMIN_API_TOKEN ?? "";
}

/** Who staff decisions are recorded as in the audit log. */
export function adminActor(): string {
  return process.env.ADMIN_ACTOR || "admin console";
}

export function adminHeaders(): Record<string, string> {
  const token = adminApiToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "X-Admin-Actor": adminActor(),
  };
}

/** Joined's public site, for "view on Joined" links. Optional. */
export function joinedWebUrl(): string {
  return (process.env.JOINED_WEB_URL ?? "").replace(/\/$/, "");
}
