/** The href to write, or null when the address bar already shows it. */
export function listingUrlChange(current: { pathname: string; search: string }, href: string) {
  const next = href.startsWith("?") ? `${current.pathname}${href}` : href;
  const now = `${current.pathname}${current.search}`;
  return now === next ? null : next;
}

/** Rebuilds a list page URL from its query values, leaving defaults out. */
export function listingHref(
  path: string,
  current: URLSearchParams,
  values: Record<string, string | number | null>,
) {
  const params = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(values)) {
    const text = value === null ? "" : String(value);
    if (!text || (key === "page" && text === "1")) params.delete(key);
    else params.set(key, text);
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}
