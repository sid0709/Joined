import { isHttpUrl } from "../../lib/httpUrl.js";

import { APPLY_REDIRECT_PARAM, APPLY_REDIRECT_VALUE } from "./constants.js";
import { resolveUrl } from "./html.js";

/**
 * Turn a signed-in applyUrl into an absolute URL. Relative `?handler=ApplyRedirect`
 * paths resolve against the job page. Do not follow the redirect.
 */
export function resolveApplyUrl(raw, pageUrl) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  if (isHttpUrl(trimmed)) return trimmed;
  return resolveUrl(trimmed, pageUrl);
}

export function isApplyRedirect(url) {
  try {
    return new URL(url).searchParams.get(APPLY_REDIRECT_PARAM) === APPLY_REDIRECT_VALUE;
  } catch {
    return false;
  }
}
