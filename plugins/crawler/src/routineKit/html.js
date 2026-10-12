import { queryAll } from "./extract.js";

/**
 * Parse HTML into a document. The side panel has DOMParser; tests install linkedom
 * (see testing/domParser.js).
 */

export function documentFromHtml(html) {
  const Parser = globalThis.DOMParser;
  if (typeof Parser !== "function") {
    throw new Error("DOMParser is required to parse HTML");
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
  const document = documentFromHtml(`<html><body>${html}</body></html>`);
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

/** True when a value is present for a declared field. */
export function isFound(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.values(value).some((item) => isFound(item));
  return true;
}

export function valueAt(record, path) {
  return String(path)
    .split(".")
    .reduce((current, key) => current?.[key], record);
}

/** First match of `selector` whose normalized text equals `label`. Never use :-soup-contains. */
export function firstElementByText(root, selector, label) {
  const needle = normalizeSpace(label).toLowerCase();
  if (!root || !needle) return null;
  for (const node of queryAll(root, selector)) {
    if (textOf(node).toLowerCase() === needle) return node;
  }
  return null;
}
