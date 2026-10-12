import { applyTransforms } from "./transforms.js";

/**
 * Reads fields from a DOM root. Runs in the content script against the live page; it
 * only needs `querySelectorAll` and the element properties a read names, so tests can
 * pass a small fake root.
 *
 * Matching is the Inspector's helper: a CSS selector, or an attribute pattern
 * (`text?` prefix, `?text` suffix, `?text?` contains, `a?b?c` mid-gaps) plus `nth`
 * when several nodes match.
 */

export const MATCH_POLL_INTERVAL_MS = 100;

export function escapeAttrSelectorValue(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

export function isAttrMatch(value) {
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value) && value.pattern != null,
  );
}

/** Inspector pattern spec: `{ tag, attr, pattern, nth }`. */
export function attrMatch({ tag = "*", attr = "class", pattern = "", nth } = {}) {
  const name = attr === "className" ? "class" : attr;
  return nth == null ? { tag, attr: name, pattern } : { tag, attr: name, pattern, nth };
}

function patternParts(pattern) {
  const raw = String(pattern ?? "");
  return {
    raw,
    startsOpen: raw.startsWith("?"),
    endsOpen: raw.endsWith("?") && raw.length >= 1,
    parts: raw.split("?").filter((part) => part.length > 0),
  };
}

/** True when `value` matches an Inspector `?` pattern (prefix, suffix, contains, mid-gaps). */
export function valueMatchesPattern(value, pattern) {
  const haystack = String(value ?? "");
  const { raw, parts, startsOpen, endsOpen } = patternParts(pattern);
  if (!raw.includes("?")) return haystack === raw;
  if (!parts.length) return true;
  let cursor = 0;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const at = haystack.indexOf(part, cursor);
    if (at < 0) return false;
    if (index === 0 && !startsOpen && at !== 0) return false;
    cursor = at + part.length;
  }
  return endsOpen || cursor === haystack.length;
}

function cssForPattern(tag, attr, pattern) {
  const { raw, parts, startsOpen, endsOpen } = patternParts(pattern);
  const name = attr === "className" ? "class" : attr;
  const host = tag || "*";
  if (!raw.includes("?")) {
    return `${host}[${name}="${escapeAttrSelectorValue(raw)}"]`;
  }
  if (parts.length === 1 && startsOpen && endsOpen) {
    return `${host}[${name}*="${escapeAttrSelectorValue(parts[0])}"]`;
  }
  if (parts.length === 1 && !startsOpen && endsOpen) {
    return `${host}[${name}^="${escapeAttrSelectorValue(parts[0])}"]`;
  }
  if (parts.length === 1 && startsOpen && !endsOpen) {
    return `${host}[${name}$="${escapeAttrSelectorValue(parts[0])}"]`;
  }
  if (parts[0]) return `${host}[${name}*="${escapeAttrSelectorValue(parts[0])}"]`;
  return host;
}

function pickNth(nodes, nth) {
  if (nth == null) return nodes;
  const indexes = Array.isArray(nth) ? nth : [nth];
  return indexes.map((index) => nodes[index]).filter(Boolean);
}

function queryCss(root, css) {
  try {
    return Array.from(root?.querySelectorAll?.(css) ?? []);
  } catch (error) {
    console.warn("Routine selector is invalid", css, error);
    return [];
  }
}

/**
 * Inspector matching: attribute patterns from findElements (`text?`, `?text`, `?text?`,
 * mid-gaps) and an optional `nth` when several nodes match.
 */
export function matchElements(root, spec = {}) {
  const tag = spec.tag || spec.componentType || "*";
  const attr =
    spec.attr === "className" || spec.propertyName === "className"
      ? "class"
      : spec.attr || spec.propertyName || "id";
  const pattern = spec.pattern ?? "";
  const css = cssForPattern(tag, attr, pattern);
  const nodes = queryCss(root, css).filter((node) =>
    valueMatchesPattern(node.getAttribute?.(attr) ?? node[attr] ?? "", pattern),
  );
  return pickNth(nodes, spec.nth ?? spec.order);
}

/**
 * Content-script shape: findElements(tag, attr, pattern). `root` is `document`
 * in the page; tests pass a document from fixtures.
 */
export function findElements(componentType, propertyName, pattern, root = globalThis.document) {
  return matchElements(root, { tag: componentType, attr: propertyName, pattern });
}

export function waitForElements(
  componentType,
  propertyName,
  pattern,
  timeoutMs = 2000,
  intervalMs = MATCH_POLL_INTERVAL_MS,
  root = globalThis.document,
) {
  return waitForMatches(
    root,
    attrMatch({ tag: componentType, attr: propertyName, pattern }),
    timeoutMs,
    intervalMs,
  ).then((matches) => (matches.length ? matches : null));
}

/** Matches of the first selector (CSS or Inspector pattern) that matches anything. */
export function queryAll(root, selector) {
  const candidates = Array.isArray(selector) ? selector : [selector];
  for (const candidate of candidates) {
    const matches = isAttrMatch(candidate)
      ? matchElements(root, candidate)
      : queryCss(root, candidate);
    if (matches.length) return matches;
  }
  return [];
}

export function queryOne(root, selector) {
  return queryAll(root, selector)[0] ?? null;
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

/**
 * Rewrite CSS-module `__<hash>` suffixes so extraction can be proven against a
 * different hash without changing the stable `index_<name>__` prefix.
 */
export function rewriteHashedSuffixes(html, replacement = "ZZZZ9") {
  return String(html ?? "").replace(/(index_[A-Za-z0-9-]+)__[A-Za-z0-9_-]+/g, `$1__${replacement}`);
}
