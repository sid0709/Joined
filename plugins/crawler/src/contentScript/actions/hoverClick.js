import { queryAll } from "../../routineKit/extract.js";
import {
  findMarkAppliedControl,
  findMarkAppliedInOverlay,
} from "../../routines/hiringcafe/appliedState.js";
import { MARK_APPLIED_TEXT } from "../../routines/hiringcafe/constants.js";

import { clickLikeHuman } from "./dom";

const HOVER_EVENT_TYPES = ["pointerover", "pointerenter", "mouseover", "mouseenter", "mousemove"];

function elementText(element) {
  return String(element?.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function pickMatch(elements, { nth = 0, contains, exact = false } = {}) {
  const needle = String(contains || "")
    .trim()
    .toLowerCase();
  if (!needle) return elements[nth] || null;
  const matches = elements.filter((element) => {
    const text = elementText(element).toLowerCase();
    return exact ? text === needle : text.includes(needle);
  });
  matches.sort((left, right) => elementText(left).length - elementText(right).length);
  return matches[nth] || matches[0] || null;
}

export function hoverAt(element, { x = 100, y = 100 } = {}) {
  const rect = element.getBoundingClientRect?.() || { left: 0, top: 0 };
  const clientX = rect.left + x;
  const clientY = rect.top + y;
  const opts = {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    view: typeof window !== "undefined" ? window : undefined,
  };
  for (const type of HOVER_EVENT_TYPES) {
    try {
      element.dispatchEvent(new MouseEvent(type, opts));
    } catch {
      /* stand-in nodes in tests may not implement dispatchEvent */
    }
  }
}

function clickMatch(root, { selector, contains, exact = false, nth = 0 } = {}) {
  const needle = String(contains || "").trim();
  const target =
    (needle === MARK_APPLIED_TEXT || !needle
      ? findMarkAppliedInOverlay(root) || findMarkAppliedControl(root)
      : null) || pickMatch(queryAll(root, selector), { nth, contains, exact });
  if (!target) return { found: false };
  clickLikeHuman(target);
  return { found: true };
}

/**
 * Hover-only overlays (HiringCafe Mark Applied) stay hidden unless the card is
 * hovered in the same turn as the click.
 */
export function hoverClickInDocument(
  root,
  {
    selector,
    clickSelector,
    nth = 0,
    contains,
    exact = false,
    offsets = [{ x: 100, y: 100 }],
  } = {},
) {
  const cards = queryAll(root, selector);
  const card = cards[nth];
  if (!card) return { found: false, hovered: false };
  const clickSel = clickSelector || selector;
  for (const offset of offsets) {
    hoverAt(card, offset);
    const clicked = clickMatch(card, { selector: clickSel, contains, exact });
    if (clicked.found) return { found: true, hovered: true };
  }
  return { found: false, hovered: true };
}
