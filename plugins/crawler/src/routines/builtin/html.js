/**
 * Built In HTML helpers. Shared parsing lives in routineKit/html.js.
 */

export {
  documentFromHtml,
  htmlToPlainText,
  normalizeSpace,
  originOf,
  resolveUrl,
  textOf,
} from "../../routineKit/html.js";

export function isBuiltinHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "builtin.com" || host === "www.builtin.com" || host.endsWith(".builtin.com");
}

export function isBuiltinUrl(url, base) {
  try {
    return isBuiltinHost(new URL(url, base).hostname);
  } catch {
    return false;
  }
}
