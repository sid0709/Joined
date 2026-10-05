import { applyTransforms } from "./transforms.js";

/**
 * Reads fields from a DOM root. Runs in the content script against the live page; it
 * only needs `querySelectorAll` and the element properties a read names, so tests can
 * pass a small fake root.
 */

export const MATCH_POLL_INTERVAL_MS = 100;

/** Matches of the first selector in the list that matches anything. */
export function queryAll(root, selector) {
  const candidates = Array.isArray(selector) ? selector : [selector];
  for (const candidate of candidates) {
    let matches;
    try {
      matches = Array.from(root?.querySelectorAll?.(candidate) ?? []);
    } catch (error) {
      console.warn("Routine selector is invalid", candidate, error);
      continue;
    }
    if (matches.length) return matches;
  }
  return [];
}

/** Resolve with the matches as soon as there are any, or with [] after `timeoutMs`. */
export function waitForMatches(root, selector, timeoutMs, intervalMs = MATCH_POLL_INTERVAL_MS) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const check = () => {
      const matches = queryAll(root, selector);
      if (matches.length || Date.now() >= deadline) resolve(matches);
      else setTimeout(check, intervalMs);
    };
    check();
  });
}

/** Read one value from an element: "text", "textContent", "html", "attr:<name>", "prop:<name>". */
export function readElement(element, read) {
  if (!element) return "";
  if (read === "text") return element.innerText ?? "";
  if (read === "textContent") return element.textContent ?? "";
  if (read === "html") return element.outerHTML ?? "";
  const separator = read.indexOf(":");
  const kind = read.slice(0, separator);
  const name = read.slice(separator + 1);
  if (kind === "attr") return element.getAttribute?.(name) ?? "";
  if (kind === "prop") return element[name] == null ? "" : String(element[name]);
  return "";
}

function pickTargets(outer, field) {
  if (!field.inner) {
    if (field.all) return outer;
    const nths = Array.isArray(field.nth) ? field.nth : [field.nth];
    return nths.map((index) => outer[index] ?? null);
  }
  const scope = outer[field.nth];
  if (!scope) return [];
  const inner = queryAll(scope, field.inner);
  return field.all ? inner : [inner[field.innerNth] ?? null];
}

function readPairPart(element, [selector, read]) {
  const target = selector ? queryAll(element, selector)[0] : element;
  return String(readElement(target, read)).trim();
}

function assembleValue(targets, field) {
  if (field.read === "pairs") {
    const entries = targets
      .filter(Boolean)
      .map((element) => [
        readPairPart(element, field.pair.key),
        readPairPart(element, field.pair.value),
      ]);
    return Object.fromEntries(entries.filter(([key, value]) => key && value));
  }
  const values = targets.map((element) => readElement(element, field.read));
  if (field.all) return values;
  if (Array.isArray(field.nth)) {
    return field.join === null ? values : values.filter(Boolean).join(field.join);
  }
  return values[0] ?? "";
}

/** Read a field as the page is now. `found` is false when its selector matched nothing. */
export function extractField(root, field) {
  const outer = queryAll(root, field.selector);
  const value = assembleValue(pickTargets(outer, field), field);
  return { found: outer.length > 0, value: applyTransforms(value, field.then) };
}
