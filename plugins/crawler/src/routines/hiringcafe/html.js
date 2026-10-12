/**
 * HiringCafe HTML helpers. Shared parsing lives in routineKit/html.js.
 */

import { HIRINGCAFE_HOSTS } from "./constants.js";

export {
  documentFromHtml,
  htmlToPlainText,
  normalizeSpace,
  originOf,
  resolveUrl,
  textOf,
} from "../../routineKit/html.js";

export function isHiringCafeHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return HIRINGCAFE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

export function isHiringCafeUrl(url, base) {
  try {
    return isHiringCafeHost(new URL(url, base).hostname);
  } catch {
    return false;
  }
}
