import { CLOAK_ATTR, DISPLAY_NONE_RE, VISIBILITY_HIDDEN_RE } from "./constants.js";

function computedIsHidden(node) {
  const view = node.ownerDocument?.defaultView;
  const computed = view?.getComputedStyle?.(node);
  if (!computed) return false;
  return computed.display === "none" || computed.visibility === "hidden";
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
