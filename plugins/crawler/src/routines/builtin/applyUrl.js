import { isHttpUrl } from "../../lib/httpUrl.js";

import { APPLY_REDIRECT_PARAM, APPLY_REDIRECT_VALUE, BUILTIN_ORIGIN } from "./constants.js";
import { resolveUrl } from "./html.js";

/**
 * Turn a signed-in applyUrl into an absolute URL. Root-relative paths resolve
 * against https://builtin.com. Query-only values resolve against the job page.
 * Do not follow the redirect.
 */
export function resolveApplyUrl(raw, pageUrl = BUILTIN_ORIGIN) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  if (isHttpUrl(trimmed)) return trimmed;
  const base = trimmed.startsWith("/") ? BUILTIN_ORIGIN : pageUrl || BUILTIN_ORIGIN;
  return resolveUrl(trimmed, base);
}

export function isApplyRedirect(url) {
  try {
    return new URL(url).searchParams.get(APPLY_REDIRECT_PARAM) === APPLY_REDIRECT_VALUE;
  } catch {
    return false;
  }
}
