import { CLOAK_ATTR, DISPLAY_NONE_RE, VISIBILITY_HIDDEN_RE } from "./constants.js";

function computedIsHidden(node) {
  const view = node.ownerDocument?.defaultView;
  const computed = view?.getComputedStyle?.(node);
  if (computed?.display === "none" || computed?.visibility === "hidden") return true;
  if (computed?.position === "fixed" || computed?.position === "sticky") return false;
  const tag = String(node.tagName || "").toUpperCase();
  if (tag === "BODY" || tag === "HTML") return false;
  // Live DOM: offsetParent is null when the node is not painted. Fixtures run in
  // linkedom, which has no getComputedStyle — skip this signal there so inline
  // style / x-cloak (ownStyleHides) stay the source of truth.
  if (computed && typeof node.offsetParent !== "undefined" && node.offsetParent === null) {
    return true;
  }
  return false;
}

function ownStyleHides(node) {
  if (node.hasAttribute?.(CLOAK_ATTR) || node.hasAttribute?.("hidden")) return true;
  const style = node.getAttribute?.("style") || "";
  return DISPLAY_NONE_RE.test(style) || VISIBILITY_HIDDEN_RE.test(style);
}

/**
 * Visible in the live DOM: not `x-cloak`, not `hidden`, and not display:none /
 * visibility:hidden on this node or an ancestor (inline style or computed).
 */
export function isVisibleElement(el) {
  let node = el;
  while (node && node.nodeType === 1) {
    if (ownStyleHides(node) || computedIsHidden(node)) return false;
    node = node.parentElement;
  }
  return Boolean(el);
}
