import { normalizeOptionalHttpUrl } from "../lib/httpUrl.js";

/**
 * Named transforms a field can apply to its value, in order, via `then`.
 * A routine names them as data: `"lines"` or `["replace", " · ", ""]`, never as code,
 * so a routine stays plain JSON.
 */
const TRANSFORMS = {
  /** Trim surrounding whitespace. */
  trim: (value) => String(value ?? "").trim(),
  /** Split text into trimmed, non-empty lines. */
  lines: (value) =>
    String(value ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  /** Replace the first occurrence of `search`. */
  replace: (value, search, replacement = "") => String(value ?? "").replace(search, replacement),
  /** Keep the text and the first number in it: "120 applicants" → { count: 120, text }. */
  countedText: (value) => {
    const text = String(value ?? "");
    return { count: parseInt(text.match(/\d+/)?.[0] || "0", 10), text };
  },
  /** Keep the value only when it is an http(s) URL; otherwise "". */
  httpUrl: (value) => normalizeOptionalHttpUrl(value),
};

function parseTransform(spec) {
  const [name, ...args] = Array.isArray(spec) ? spec : [spec];
  return { name, args };
}

export function isKnownTransform(spec) {
  return Object.hasOwn(TRANSFORMS, parseTransform(spec).name);
}

export function applyTransforms(value, specs = []) {
  return specs.reduce((current, spec) => {
    const { name, args } = parseTransform(spec);
    if (!isKnownTransform(spec)) throw new Error(`Unknown transform: ${name}`);
    return TRANSFORMS[name](current, ...args);
  }, value);
}
