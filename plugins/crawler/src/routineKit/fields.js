/**
 * Field builders: what a routine reads from the page. Each returns plain data.
 *
 * `selector` is a CSS selector, or a list of them tried in order (the first one that
 * matches wins), so a routine can list a stable selector first and a fallback after it.
 *
 * Options:
 * - `nth`: which match of `selector` to read (default 0). A list reads several matches.
 * - `inner`: a selector inside the `nth` match; read that instead.
 * - `innerNth`: which match of `inner` to read (default 0).
 * - `all`: read every match (of `inner` when set, else of `selector`) as a list.
 * - `join`: with a list `nth`, join the non-empty values with this string.
 * - `then`: transforms to apply to the value (see transforms.js).
 * - `wait`: how long to wait for `selector` to appear, in ms.
 * - `label`: what people see for this field in the side panel (default: from its path).
 *
 * A field whose element is missing reads as "" (or [] / {} for lists and pairs), and
 * its transforms still run, so `then: ["lines"]` gives [] for a missing element.
 */

export const DEFAULT_FIELD_WAIT_MS = 2000;

const PLAIN_READS = ["text", "textContent", "html"];
const NAMED_READS = ["attr", "prop"];

/** True for "text", "textContent", "html", "attr:<name>", or "prop:<name>". */
export function isValidRead(read) {
  if (typeof read !== "string") return false;
  if (PLAIN_READS.includes(read)) return true;
  const separator = read.indexOf(":");
  return (
    separator > 0 && separator < read.length - 1 && NAMED_READS.includes(read.slice(0, separator))
  );
}

function field(selector, read, options = {}) {
  const {
    nth = 0,
    inner = null,
    innerNth = 0,
    all = false,
    join = null,
    then = [],
    wait = DEFAULT_FIELD_WAIT_MS,
    pair = null,
    label = null,
  } = options;
  return {
    kind: "field",
    selector,
    read,
    nth,
    inner,
    innerNth,
    all,
    join,
    then,
    wait,
    ...(label ? { label } : {}),
    ...(pair ? { pair } : {}),
  };
}

/** The element's rendered text (innerText). */
export const text = (selector, options) => field(selector, "text", options);

/** The element's text as written in the HTML, hidden text included (textContent). */
export const rawText = (selector, options) => field(selector, "textContent", options);

/** The element's markup (outerHTML). */
export const html = (selector, options) => field(selector, "html", options);

/** An attribute exactly as written in the HTML. */
export const attr = (selector, name, options) => field(selector, `attr:${name}`, options);

/** A DOM property, e.g. `href` or `src`, which the browser resolves to an absolute URL. */
export const prop = (selector, name, options) => field(selector, `prop:${name}`, options);

/**
 * Build an object from every match. `key` and `value` are `[innerSelector, read]`,
 * e.g. `key: ["img", "attr:alt"], value: ["span", "textContent"]`. Empty keys or values are dropped.
 */
export const pairs = (selector, { key, value, ...options }) =>
  field(selector, "pairs", { all: true, ...options, pair: { key, value } });
