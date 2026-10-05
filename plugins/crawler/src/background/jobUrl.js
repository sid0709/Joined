export function normalizeJobUrl(jobUrl) {
  if (!jobUrl || typeof jobUrl !== "string") return null;
  try {
    const parsed = new URL(jobUrl);
    parsed.hash = "";
    let pathname = parsed.pathname || "";
    pathname = pathname.replace(/\/+$/, "");
    if (!pathname.startsWith("/")) pathname = `/${pathname}`;
    const params = new URLSearchParams(parsed.search || "");
    const sortedEntries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    const normalizedSearch = sortedEntries.length
      ? `?${sortedEntries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")}`
      : "";
    return `${parsed.origin}${pathname}${normalizedSearch}`;
  } catch (e) {
    console.error("Failed to normalize job URL", e);
    return jobUrl.trim() || null;
  }
}

export function sameHost(urlA, urlB) {
  try {
    const hostA = new URL(urlA).host;
    const hostB = new URL(urlB).host;
    return hostA === hostB;
  } catch (e) {
    console.error("Failed to compare hosts for URLs", e);
    return false;
  }
}
