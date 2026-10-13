import { queryAll, queryOne } from "../../routineKit/extract.js";
import { isVisibleElement } from "../builtin/visible.js";

import {
  APP_TRACKER_TEXT,
  APPLIED_CHECK_RE,
  APPLIED_CHECK_TEXT,
  APPLIED_TOGGLE_TEXT,
  CARD_APPLIED_CHIP,
  CARD_HOVER_LAYER,
  CARD_OVERLAY,
  CARD_OVERLAY_ROW,
  CARD_ROOT,
  JOB_CARD,
  jobCardSelector,
  jobCardSelectorForJobs,
  MARK_APPLIED_CONTROL,
  MARK_APPLIED_TEXT,
  MARK_OVERLAY_CANDIDATE_MAX_CHARS,
  MARK_TOAST,
  MARK_TOAST_TEXT,
  SIGN_IN_DIALOG,
  SIGN_IN_DIALOG_RE,
  UPDATE_STAGE_PATH,
} from "./constants.js";
import { documentFromHtml, textOf } from "./html.js";
import { readSignedIn } from "./parseNextData.js";

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasExactText(root, needle) {
  const want = normalizeText(needle).toLowerCase();
  if (!want || !root) return false;
  for (const node of queryAll(root, "span, div, button, p")) {
    if (normalizeText(textOf(node)).toLowerCase() === want) return true;
  }
  return false;
}

export function cardSelectorForJob(job) {
  return jobCardSelector(job) || jobCardSelectorForJobs([job]);
}

export function cardForJob(document, job) {
  const exact = jobCardSelector(job);
  if (exact) {
    const card = queryOne(document, exact);
    if (card) return card;
  }
  const selector = cardSelectorForJob(job);
  return selector ? queryOne(document, selector) : null;
}

function asRoot(root) {
  if (!root) return null;
  return typeof root === "string" ? documentFromHtml(root) : root;
}

function isOverlayShell(node) {
  return Boolean(
    node?.matches?.(CARD_HOVER_LAYER) ||
    node?.matches?.(CARD_OVERLAY) ||
    node?.matches?.(CARD_APPLIED_CHIP) ||
    node?.matches?.(CARD_OVERLAY_ROW),
  );
}

function hasMarkAppliedText(root) {
  return Boolean(findExactMarkApplied(asRoot(root)));
}

function isMarkOverlay(node) {
  if (!node) return false;
  if (hasMarkAppliedText(node) || hasAppliedCheck(node)) return true;
  if (hasAppTracker(node) && !hasMarkAppliedText(node)) return true;
  if (hasAppliedToggle(node) && hasAppTracker(node)) return true;
  return Boolean(node.matches?.(CARD_OVERLAY) && (hasAppliedToggle(node) || hasAppTracker(node)));
}

function hoverLayerOf(node) {
  return node?.closest?.(CARD_HOVER_LAYER) || null;
}

function owningCard(node) {
  if (!node || node.nodeType !== 1 || typeof node.closest !== "function") return node;
  return node.closest(CARD_ROOT) || node.closest(JOB_CARD) || node;
}

function overlayLayerIn(root) {
  if (!root) return null;
  const hover = hoverLayerOf(root);
  if (hover && isMarkOverlay(hover)) return hover;
  if (root.nodeType === 1 && isOverlayShell(root) && isMarkOverlay(root)) {
    return hoverLayerOf(root) || root.closest?.(CARD_OVERLAY) || root;
  }
  const search = owningCard(root);
  for (const layer of queryAll(search, CARD_HOVER_LAYER)) {
    if (isMarkOverlay(layer)) return layer;
  }
  for (const overlay of queryAll(search, CARD_OVERLAY)) {
    if (isMarkOverlay(overlay)) return hoverLayerOf(overlay) || overlay;
  }
  for (const chip of queryAll(search, CARD_APPLIED_CHIP)) {
    if (hasAppliedCheck(chip) || hasAppliedToggle(chip)) return hoverLayerOf(chip) || chip;
  }
  for (const row of queryAll(search, CARD_OVERLAY_ROW)) {
    if (isMarkOverlay(row)) return hoverLayerOf(row) || row.closest?.(CARD_OVERLAY) || row;
  }
  return null;
}

/**
 * Hover overlay only. Walks a hover hit (the live justify-between row) up to
 * the card, then the `cursor-zoom-in` layer. Empty `top-0 right-0` decoys and
 * the card itself do not count.
 */
export function overlayRoot(root) {
  return overlayLayerIn(asRoot(root));
}

/** Hit is on this card; overlay is the card's hover layer, not the hit itself. */
export function overlayFromHit(hit, card) {
  if (!card) return overlayRoot(hit);
  if (!hit) return overlayRoot(card);
  if (!(hit === card || card.contains?.(hit))) return null;
  return overlayRoot(hit) || overlayRoot(card);
}

/** Visible `Applied ✓` on the list card. Opacity/grayscale classes are not a skip. */
export function isListCardApplied(card) {
  if (!card) return false;
  return hasAppliedCheck(card);
}

function sortExactMatches(matches) {
  return matches.sort((left, right) => {
    const leftKids = left.childElementCount || 0;
    const rightKids = right.childElementCount || 0;
    if (leftKids !== rightKids) return leftKids - rightKids;
    const leftButton = left.tagName === "BUTTON" ? 0 : 1;
    const rightButton = right.tagName === "BUTTON" ? 0 : 1;
    return leftButton - rightButton;
  });
}

function exactMatches(root, needle) {
  const want = normalizeText(needle);
  if (!want || !root) return [];
  const matches = [];
  for (const node of queryAll(root, MARK_APPLIED_CONTROL)) {
    if (normalizeText(textOf(node)) === want) matches.push(node);
  }
  return sortExactMatches(matches);
}

function exactVisibleMatches(root, needle) {
  const matches = exactMatches(asRoot(root), needle);
  const visible = matches.filter((node) => isVisibleElement(node));
  return visible.length ? visible : matches;
}

function hasAppliedCheckIcon(root) {
  for (const el of queryAll(root, "span, div")) {
    if (normalizeText(textOf(el)) !== APPLIED_TOGGLE_TEXT) continue;
    if (el.querySelector?.("svg")) return true;
  }
  return false;
}

export function hasAppliedCheck(root) {
  const node = asRoot(root);
  if (!node) return false;
  return (
    hasExactText(node, APPLIED_CHECK_TEXT) ||
    APPLIED_CHECK_RE.test(textOf(node)) ||
    hasAppliedCheckIcon(node)
  );
}

export function hasAppliedToggle(root) {
  return Boolean(exactVisibleMatches(asRoot(root), APPLIED_TOGGLE_TEXT)[0]);
}

export function hasAppTracker(root) {
  return Boolean(exactVisibleMatches(asRoot(root), APP_TRACKER_TEXT)[0]);
}

/** Overlay already flipped: Applied ✓, Applied, or App Tracker. */
export function hasAppliedState(root) {
  return hasAppliedCheck(root) || hasAppliedToggle(root) || hasAppTracker(root);
}

export function appliedFromCandidateTexts(candidates = []) {
  const texts = (candidates ?? []).map((value) => normalizeText(value)).filter(Boolean);
  if (texts.some((text) => text === MARK_APPLIED_TEXT)) return false;
  return texts.some((text) => {
    return (
      text === APPLIED_CHECK_TEXT ||
      text === APPLIED_TOGGLE_TEXT ||
      text === APP_TRACKER_TEXT ||
      APPLIED_CHECK_RE.test(text)
    );
  });
}

function findExactMarkApplied(root) {
  return exactMatches(root, MARK_APPLIED_TEXT)[0] || null;
}

/** Button/div/span whose trimmed text is exactly `Mark Applied`. */
export function findMarkAppliedControl(root) {
  return exactVisibleMatches(asRoot(root), MARK_APPLIED_TEXT)[0] || null;
}

/** Exact `Mark Applied` inside the card's hover overlay layer. */
export function findMarkAppliedInOverlay(card) {
  const overlay = overlayRoot(card);
  return overlay ? findExactMarkApplied(overlay) : null;
}

export function overlayCandidateTexts(root) {
  const node = asRoot(root);
  if (!node) return [];
  const seen = new Set();
  const texts = [];
  for (const candidate of queryAll(node, MARK_APPLIED_CONTROL)) {
    const text = normalizeText(textOf(candidate));
    if (!text || text.length > MARK_OVERLAY_CANDIDATE_MAX_CHARS) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    texts.push(text);
  }
  return texts;
}

/** Applied-state texts from this card's hover overlay only. Finding stays card-wide. */
export function overlayAppliedCandidateTexts(root) {
  return overlayCandidateTexts(overlayRoot(root));
}

/**
 * Overlay on this job's card, else Mark Applied's immediate container.
 * With no card, never the first overlay on the page — only that container.
 */
export function markStateRoot(html, job = {}) {
  const document = asRoot(html);
  if (!document) return null;
  const card = cardForJob(document, job);
  if (card) {
    const overlay = overlayRoot(card);
    if (overlay) return overlay;
  }
  return findMarkAppliedControl(card || document)?.parentElement || null;
}

export function hasMarkAppliedControl(root) {
  return Boolean(findMarkAppliedControl(root));
}

function toastPresent(html) {
  if (!html) return false;
  const document = documentFromHtml(html);
  return queryAll(document, MARK_TOAST).some((node) =>
    normalizeText(textOf(node)).includes(MARK_TOAST_TEXT),
  );
}

/** True when the toast is present. Pass `beforeHtml` to require it appeared after the click. */
export function hasMarkToast(html, beforeHtml) {
  if (beforeHtml !== undefined) return !toastPresent(beforeHtml) && toastPresent(html);
  return toastPresent(html);
}

export function hasVisibleSignInModal(html) {
  if (!html) return false;
  const document = documentFromHtml(html);
  return queryAll(document, SIGN_IN_DIALOG).some(
    (dialog) => isVisibleElement(dialog) && SIGN_IN_DIALOG_RE.test(textOf(dialog)),
  );
}

/** `ssrSignedIn`, or a visible sign-in modal. Hidden copy and raw HTML are ignored. */
export function isHiringCafeSignedOut(html) {
  const signedIn = readSignedIn(html);
  if (signedIn === true) return false;
  if (signedIn === false) return true;
  return hasVisibleSignInModal(html);
}

export function isSignedOutWall(html) {
  return isHiringCafeSignedOut(html);
}

export function appliedStateFromHtml(html, job = {}) {
  const document = documentFromHtml(html);
  const card = cardForJob(document, job);
  const overlay = overlayRoot(card);
  const marked = Boolean(overlay && hasAppliedState(overlay));
  return {
    found: Boolean(card),
    marked,
    canMark: Boolean(
      !marked &&
      ((overlay && hasMarkAppliedControl(overlay)) || (card && hasMarkAppliedControl(card))),
    ),
    toast: hasMarkToast(html),
    signedOut: isHiringCafeSignedOut(html),
  };
}

function requestMentionsJob(hit, jobId) {
  const url = String(hit?.url || "");
  const request = String(hit?.request || hit?.requestBody || "");
  return url.includes(jobId) || request.includes(jobId);
}

export function stageUpdateSucceeded(hits = [], job = {}) {
  const jobId = String(job?.id || "").trim();
  if (!jobId) return false;
  return hits.some((hit) => {
    const url = String(hit?.url || "");
    const body = String(hit?.body || "");
    return (
      url.includes(UPDATE_STAGE_PATH) &&
      hit?.status === 200 &&
      /update successful/i.test(body) &&
      requestMentionsJob(hit, jobId)
    );
  });
}

export function markConfirmed({ applied, tracker, toast, fetchOk }) {
  return Boolean(applied || tracker || toast || fetchOk);
}
