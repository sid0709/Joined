import { queryAll } from "../../routineKit/extract.js";
import { MARK_HOVER_OFFSET, MARK_OVERLAY_POLL_MS } from "../../routines/hiringcafe/constants.js";

import { wait } from "./dom";
import { pickMatch } from "./hoverClick";
import { scrollElementIntoView } from "./scroll";

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function numberOr(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function viewportOf(explicit) {
  if (explicit && typeof explicit === "object") {
    return { width: numberOr(explicit.width), height: numberOr(explicit.height) };
  }
  if (typeof window === "undefined") return { width: 0, height: 0 };
  return {
    width: numberOr(window.innerWidth),
    height: numberOr(window.innerHeight),
  };
}

function rectOf(element) {
  const rect = element?.getBoundingClientRect?.();
  if (!rect) return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
  return {
    left: numberOr(rect.left),
    top: numberOr(rect.top),
    width: numberOr(rect.width),
    height: numberOr(rect.height),
    right: numberOr(rect.right, numberOr(rect.left) + numberOr(rect.width)),
    bottom: numberOr(rect.bottom, numberOr(rect.top) + numberOr(rect.height)),
  };
}

/**
 * Trusted hover point: card offset (100, 100) when that pixel is still on the
 * card and inside the (side-panel-narrowed) viewport; otherwise the clamped
 * card center.
 */
export function viewportHoverPoint(rect, offset = MARK_HOVER_OFFSET, viewport = {}) {
  const view = viewportOf(viewport);
  const left = numberOr(rect?.left);
  const top = numberOr(rect?.top);
  const width = numberOr(rect?.width);
  const height = numberOr(rect?.height);
  const preferredX = left + numberOr(offset?.x, MARK_HOVER_OFFSET.x);
  const preferredY = top + numberOr(offset?.y, MARK_HOVER_OFFSET.y);
  const inCard =
    preferredX >= left &&
    preferredX <= left + width &&
    preferredY >= top &&
    preferredY <= top + height;
  const inView =
    view.width > 0 &&
    view.height > 0 &&
    preferredX >= 0 &&
    preferredX <= view.width &&
    preferredY >= 0 &&
    preferredY <= view.height;
  if (inCard && inView) return { x: preferredX, y: preferredY };
  const centerX = left + width / 2;
  const centerY = top + height / 2;
  if (view.width <= 0 || view.height <= 0) return { x: centerX, y: centerY };
  return {
    x: clamp(centerX, 1, Math.max(1, view.width - 1)),
    y: clamp(centerY, 1, Math.max(1, view.height - 1)),
  };
}

function pointFromRect(rect, viewport) {
  const view = viewportOf(viewport);
  const x = numberOr(rect.left) + numberOr(rect.width) / 2;
  const y = numberOr(rect.top) + numberOr(rect.height) / 2;
  if (view.width <= 0 || view.height <= 0) return { x, y };
  return {
    x: clamp(x, 1, Math.max(1, view.width - 1)),
    y: clamp(y, 1, Math.max(1, view.height - 1)),
  };
}

export function hoverTargetInDocument(
  root,
  { selector, nth = 0, x = MARK_HOVER_OFFSET.x, y = MARK_HOVER_OFFSET.y } = {},
  viewport,
) {
  scrollElementIntoView(root, { selector });
  const card = queryAll(root, selector)[nth];
  if (!card) return { found: false };
  const rect = rectOf(card);
  const point = viewportHoverPoint(rect, { x, y }, viewport);
  return { found: true, ...point };
}

export function overlayTargetInDocument(
  root,
  { selector, clickSelector, nth = 0, contains, exact = false } = {},
  viewport,
) {
  const card = queryAll(root, selector)[nth];
  if (!card) return { found: false };
  const clickSel = clickSelector || selector;
  const target = pickMatch(queryAll(card, clickSel), { contains, exact });
  if (!target) return { found: false };
  return { found: true, ...pointFromRect(rectOf(target), viewport) };
}

export async function waitForOverlayTarget(root, payload = {}, now = Date.now) {
  const timeout = Math.max(0, numberOr(payload.wait));
  const deadline = now() + timeout;
  for (;;) {
    const found = overlayTargetInDocument(root, payload);
    if (found.found || now() >= deadline) return found;
    await wait(MARK_OVERLAY_POLL_MS);
  }
}
