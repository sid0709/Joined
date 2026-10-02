/** Whether the live page is still on the bound job's apply site. */

function parseHttpUrl(value: string): URL | null {
  try {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function rootDomain(hostname: string): string {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return host;
  return parts.slice(-2).join(".");
}

/** True when page and apply URL share an eTLD+1 (e.g. boards vs job-boards). */
export function sameApplySite(pageUrl: string, applyUrl: string): boolean {
  const page = parseHttpUrl(pageUrl);
  const apply = parseHttpUrl(applyUrl);
  if (!page || !apply) return false;
  return rootDomain(page.hostname) === rootDomain(apply.hostname);
}

const TRACKING_QUERY = /^(utm_|ref$|fbclid$|gclid$|mc_|icid$)/i;

/** Origin + path + non-tracking query, so an already-open apply tab can be reused. */
export function canonicalApplyHref(value: string): string | null {
  const url = parseHttpUrl(value);
  if (!url) return null;
  url.hash = "";
  url.hostname = url.hostname.replace(/\.$/, "").toLowerCase();
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  const kept = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING_QUERY.test(key))
    .sort(([a], [b]) => a.localeCompare(b));
  url.search = "";
  for (const [key, val] of kept) url.searchParams.append(key, val);
  return url.href;
}

export function sameApplyPage(pageUrl: string, applyUrl: string): boolean {
  const page = canonicalApplyHref(pageUrl);
  const apply = canonicalApplyHref(applyUrl);
  return Boolean(page && apply && page === apply);
}
