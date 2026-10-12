/**
 * Parse server-rendered HTML into a document. The side panel has DOMParser;
 * tests install linkedom (see testing/domParser.js).
 */

export function documentFromHtml(html) {
  const Parser = globalThis.DOMParser;
  if (typeof Parser !== "function") {
    throw new Error("DOMParser is required to parse Built In HTML");
  }
  return new Parser().parseFromString(String(html ?? ""), "text/html");
}

export function normalizeSpace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function textOf(element) {
  if (!element) return "";
  return normalizeSpace(element.innerText ?? element.textContent ?? "");
}

export function htmlToPlainText(html) {
  if (!html) return "";
  const document = documentFromHtml(`<div>${html}</div>`);
  return normalizeSpace(document.body?.textContent ?? "");
}

export function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

export function resolveUrl(url, base) {
  if (!url) return "";
  try {
    return new URL(url, base).href;
  } catch {
    return "";
  }
}

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
