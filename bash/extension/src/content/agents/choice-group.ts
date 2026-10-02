/**
 * Fields whose visible options are custom controls backed by a hidden native input.
 *
 * A hidden proxy input carries no answer a person can see: `checked === false` is
 * indistinguishable from "nobody answered yet", so a negative answer read off the
 * proxy is a false positive and a negative answer written to the proxy is a no-op.
 * The control that holds the answer is the visible option carrying that label.
 *
 * Structural only — roles, visibility and the option's own text. No vendor class
 * or component allowlists.
 */

const GROUP_SELECTOR = [
  "fieldset",
  '[role="group"]',
  '[role="radiogroup"]',
  '[class*="Field"]',
  '[class*="field"]',
  "td",
  "th",
  "form",
].join(", ");

const CHOICE_SELECTOR = [
  "button",
  '[role="button"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="switch"]',
  "[aria-pressed]",
  "[aria-checked]",
].join(", ");

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(/[^\p{L}\p{N}+]+/u)
    .filter(Boolean);
}

/** `want` appears in `have` as a whole run of words ("no" ≠ "none of the above"). */
function containsWordRun(have: string[], want: string[]): boolean {
  if (!want.length || want.length > have.length) return false;
  for (let i = 0; i <= have.length - want.length; i += 1) {
    if (want.every((token, j) => have[i + j] === token)) return true;
  }
  return false;
}

function isDisplayed(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false;
  const style = el.ownerDocument?.defaultView?.getComputedStyle(el);
  if (!style) return Boolean(el.offsetParent);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

/** Big enough for a person to aim at, not a 0×0 or off-screen proxy. */
export function hasClickableBox(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 2 && rect.height > 2 && isDisplayed(el);
}

/** True when the planned node is a control nobody can see or click. */
export function isProxyControl(el: Element): boolean {
  return !hasClickableBox(el);
}

/** The option's own label — what the person reads on the control. */
export function choiceOptionLabel(el: Element): string {
  const html = el as HTMLElement;
  return (
    html.getAttribute?.("aria-label") ||
    html.getAttribute?.("title") ||
    html.innerText ||
    html.textContent ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function labelIsValue(el: Element, value: string): boolean {
  const want = normalize(value);
  const have = normalize(choiceOptionLabel(el));
  if (!want || !have) return false;
  if (have === want) return true;
  return containsWordRun(tokens(have), tokens(want));
}

/** The field this control belongs to: nearest grouping container. */
function groupRoot(el: Element): ParentNode {
  return el.closest(GROUP_SELECTOR) || el.parentElement || el.ownerDocument || document;
}

/**
 * The visible control inside this field whose own label is `value` — the option
 * a person would click to give that answer. Null when the field offers no such
 * option, in which case the caller's native handling still applies.
 */
export function findVisibleChoiceOption(el: Element, value: string): HTMLElement | null {
  if (!value.trim()) return null;
  const nodes = Array.from(groupRoot(el).querySelectorAll(CHOICE_SELECTOR)).filter(
    (node): node is HTMLElement => node instanceof HTMLElement && hasClickableBox(node),
  );
  return nodes.find((node) => labelIsValue(node, value)) || null;
}
