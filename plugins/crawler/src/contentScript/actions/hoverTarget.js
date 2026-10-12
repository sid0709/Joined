import { queryAll } from "../../routineKit/extract.js";
import {
  MARK_HOVER_OFFSET,
  MARK_HOVER_STEPS,
  MARK_OVERLAY_POLL_MS,
  SCROLL_SETTLE_MS,
} from "../../routines/hiringcafe/constants.js";

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

export function viewportOf(explicit) {
  if (explicit && typeof explicit === "object") {
    return { width: numberOr(explicit.width), height: numberOr(explicit.height) };
  }
  if (typeof window === "undefined") return { width: 0, height: 0 };
  return {
    width: numberOr(window.innerWidth),
    height: numberOr(window.innerHeight),
  };
}

export function rectOf(element) {
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

export function cardViewportIntersection(rect, viewport = {}) {
  const view = viewportOf(viewport);
  const left = Math.max(numberOr(rect?.left), 0);
  const top = Math.max(numberOr(rect?.top), 0);
  const right = Math.min(
    numberOr(rect?.right, numberOr(rect?.left) + numberOr(rect?.width)),
    view.width,
  );
  const bottom = Math.min(
    numberOr(rect?.bottom, numberOr(rect?.top) + numberOr(rect?.height)),
    view.height,
  );
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

/**
 * CSS-pixel point in the main-frame viewport. Prefer card offset (100, 100)
 * when it stays on the card and in the (side-panel-narrowed) viewport;
 * otherwise the visible-card center. Never scale by devicePixelRatio.
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
  if (inCard && inView) return { x: preferredX, y: preferredY, clamped: false };
  const visible = cardViewportIntersection(
    { left, top, width, height, right: left + width, bottom: top + height },
    view,
  );
  if (visible.width > 0 && visible.height > 0) {
    return {
      x: clamp(visible.left + visible.width / 2, 1, Math.max(1, view.width - 1)),
      y: clamp(visible.top + visible.height / 2, 1, Math.max(1, view.height - 1)),
      clamped: true,
    };
  }
  const centerX = left + width / 2;
  const centerY = top + height / 2;
  if (view.width <= 0 || view.height <= 0) return { x: centerX, y: centerY, clamped: true };
  return {
    x: clamp(centerX, 1, Math.max(1, view.width - 1)),
    y: clamp(centerY, 1, Math.max(1, view.height - 1)),
    clamped: true,
  };
}

export function outsideHoverPoint(rect, dest, viewport = {}) {
  const view = viewportOf(viewport);
  const left = numberOr(rect?.left);
  const top = numberOr(rect?.top);
  const right = numberOr(rect?.right, left + numberOr(rect?.width));
  const bottom = numberOr(rect?.bottom, top + numberOr(rect?.height));
  const destX = numberOr(dest?.x, left + 8);
  const destY = numberOr(dest?.y, top + 8);
  let x = destX;
  let y = destY;
  if (top >= 12) y = top - 8;
  else if (left >= 12) x = left - 8;
  else if (view.height > 0 && bottom + 8 < view.height) y = bottom + 8;
  else if (view.width > 0 && right + 8 < view.width) x = right + 8;
  else y = Math.max(1, top - 1);
  if (view.width > 0) x = clamp(x, 1, Math.max(1, view.width - 1));
  if (view.height > 0) y = clamp(y, 1, Math.max(1, view.height - 1));
  return { x, y };
}

export function approachPoints(rect, dest, viewport = {}, steps = MARK_HOVER_STEPS) {
  const start = outsideHoverPoint(rect, dest, viewport);
  const count = Math.max(1, Number(steps) || MARK_HOVER_STEPS);
  const points = [start];
  for (let index = 1; index <= count; index += 1) {
    const t = index / count;
    points.push({
      x: start.x + (numberOr(dest?.x) - start.x) * t,
      y: start.y + (numberOr(dest?.y) - start.y) * t,
    });
  }
  return points;
}

function describeHit(node) {
  if (!node) return { tag: "", classes: "" };
  return {
    tag: String(node.tagName || ""),
    classes: String(node.className || "").trim(),
  };
}

export function hitInsideCard(card, x, y, elementFromPoint) {
  const node = typeof elementFromPoint === "function" ? elementFromPoint(x, y) : null;
  const info = describeHit(node);
  if (!node || !card) return { ok: false, ...info };
  const inside = node === card || Boolean(card.contains?.(node));
  return { ok: inside, ...info };
}

function elementFromPointOf(root, explicit) {
  if (typeof explicit === "function") return explicit;
  if (typeof root?.elementFromPoint === "function") {
    return (x, y) => root.elementFromPoint(x, y);
  }
  if (typeof document !== "undefined" && typeof document.elementFromPoint === "function") {
    return (x, y) => document.elementFromPoint(x, y);
  }
  return () => null;
}

function scrollOf() {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  return { x: numberOr(window.scrollX), y: numberOr(window.scrollY) };
}

function dprOf() {
  if (typeof window === "undefined") return 1;
  const value = Number(window.devicePixelRatio);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function formatHoverDiagnostics(diag) {
  if (!diag || typeof diag !== "object") return "";
  const rect = diag.rect || {};
  const view = diag.viewport || {};
  const scroll = diag.scroll || {};
  const hit = diag.hit || {};
  const classes = String(hit.classes || "")
    .trim()
    .replace(/\s+/g, ".");
  const hitLabel = [hit.tag, classes].filter(Boolean).join(".");
  return [
    `rect=${numberOr(rect.left)},${numberOr(rect.top)} ${numberOr(rect.width)}x${numberOr(rect.height)}`,
    `viewport=${numberOr(view.width)}x${numberOr(view.height)}`,
    `scroll=${numberOr(scroll.x)},${numberOr(scroll.y)}`,
    `dpr=${diag.dpr ?? 1}`,
    `hit=${hitLabel || "none"}`,
    `overlay=${diag.overlay ? "yes" : "no"}`,
  ].join(" ");
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

function resolvePoint(card, offset, viewport, elementFromPoint) {
  const rect = rectOf(card);
  const preferred = viewportHoverPoint(rect, offset, viewport);
  let hit = hitInsideCard(card, preferred.x, preferred.y, elementFromPoint);
  if (hit.ok) return { point: preferred, hit, rect };
  const fallback = viewportHoverPoint(rect, { x: rect.width / 2, y: rect.height / 2 }, viewport);
  const retry = hitInsideCard(card, fallback.x, fallback.y, elementFromPoint);
  if (retry.ok) return { point: { ...fallback, clamped: true }, hit: retry, rect };
  return { point: preferred, hit, rect };
}

export async function hoverTargetInDocument(
  root,
  { selector, nth = 0, x = MARK_HOVER_OFFSET.x, y = MARK_HOVER_OFFSET.y } = {},
  viewport,
  elementFromPoint,
) {
  scrollElementIntoView(root, { selector, block: "center", inline: "nearest" });
  if (SCROLL_SETTLE_MS > 0) await wait(SCROLL_SETTLE_MS);
  const card = queryAll(root, selector)[nth];
  const view = viewportOf(viewport);
  const empty = {
    found: false,
    diagnostics: {
      rect: rectOf(card),
      viewport: view,
      scroll: scrollOf(),
      dpr: dprOf(),
      hit: { tag: "", classes: "" },
      overlay: false,
    },
  };
  if (!card) {
    return { ...empty, diagnosticsText: formatHoverDiagnostics(empty.diagnostics) };
  }
  const hitAt = elementFromPointOf(root, elementFromPoint);
  const resolved = resolvePoint(card, { x, y }, view, hitAt);
  const diagnostics = {
    rect: resolved.rect,
    viewport: view,
    scroll: scrollOf(),
    dpr: dprOf(),
    hit: { tag: resolved.hit.tag, classes: resolved.hit.classes },
    overlay: false,
  };
  if (!resolved.hit.ok) {
    return {
      found: false,
      clamped: Boolean(resolved.point.clamped),
      diagnostics,
      diagnosticsText: formatHoverDiagnostics(diagnostics),
    };
  }
  return {
    found: true,
    x: resolved.point.x,
    y: resolved.point.y,
    clamped: Boolean(resolved.point.clamped),
    approach: approachPoints(resolved.rect, resolved.point, view),
    diagnostics,
    diagnosticsText: formatHoverDiagnostics(diagnostics),
  };
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
