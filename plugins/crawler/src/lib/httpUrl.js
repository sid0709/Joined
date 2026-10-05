/** True for an absolute http(s) URL with a host. */
export function isHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/** Keep a URL only when it is a real http(s) URL; otherwise return "". */
export function normalizeOptionalHttpUrl(value) {
  return isHttpUrl(value) ? value.trim() : "";
}
