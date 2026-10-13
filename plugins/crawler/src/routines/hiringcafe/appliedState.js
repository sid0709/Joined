import { queryAll, queryOne } from "../../routineKit/extract.js";
import { isVisibleElement } from "../builtin/visible.js";

import {
  APP_TRACKER_TEXT,
  APPLIED_CHECK_RE,
  APPLIED_CHECK_TEXT,
  APPLIED_TOGGLE_TEXT,
  CARD_OVERLAY,
  CARD_OVERLAY_ROW,
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
  return Boolean(node?.matches?.(CARD_OVERLAY) || node?.matches?.(CARD_OVERLAY_ROW));
}

function isMarkOverlay(node) {
  if (!node) return false;
  if (hasMarkAppliedControl(node) || hasAppliedCheck(node)) return true;
  if (hasAppliedToggle(node) && hasAppTracker(node)) return true;
  return Boolean(node.matches?.(CARD_OVERLAY) && (hasAppliedToggle(node) || hasAppTracker(node)));
}

/** Hover overlay only. Empty `top-0 right-0` decoys and the card itself do not count. */
export function overlayRoot(root) {
  const node = asRoot(root);
  if (!node) return null;
  if (node.nodeType === 1 && isOverlayShell(node) && isMarkOverlay(node)) {
    return node.closest?.(CARD_OVERLAY) || node;
  }
  for (const overlay of queryAll(node, CARD_OVERLAY)) {
    if (isMarkOverlay(overlay)) return overlay;
  }
  for (const row of queryAll(node, CARD_OVERLAY_ROW)) {
    if (isMarkOverlay(row)) return row.closest?.(CARD_OVERLAY) || row;
  }
  return null;
}

/** Visible `Applied ✓` on the list card. Opacity/grayscale classes are not a skip. */
export function isListCardApplied(card) {
  if (!card) return false;
  return hasAppliedCheck(card);
}

function exactVisibleMatches(root, needle) {
  const want = normalizeText(needle);
  if (!want || !root) return [];
  const matches = [];
  for (const node of queryAll(root, MARK_APPLIED_CONTROL)) {
    if (normalizeText(textOf(node)) === want && isVisibleElement(node)) matches.push(node);
  }
  matches.sort((left, right) => {
    const leftKids = left.childElementCount || 0;
    const rightKids = right.childElementCount || 0;
    if (leftKids !== rightKids) return leftKids - rightKids;
    const leftButton = left.tagName === "BUTTON" ? 0 : 1;
    const rightButton = right.tagName === "BUTTON" ? 0 : 1;
    return leftButton - rightButton;
  });
  return matches;
}

export function hasAppliedCheck(root) {
  const node = asRoot(root);
  if (!node) return false;
  return hasExactText(node, APPLIED_CHECK_TEXT) || APPLIED_CHECK_RE.test(textOf(node));
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

/** Visible button/div/span whose trimmed text is exactly `Mark Applied`. */
export function findMarkAppliedControl(root) {
  return exactVisibleMatches(asRoot(root), MARK_APPLIED_TEXT)[0] || null;
}

export function overlayCandidateTexts(root) {
  const node = asRoot(root);
  if (!node) return [];
  const seen = new Set();
  const texts = [];
  for (const candidate of queryAll(node, MARK_APPLIED_CONTROL)) {
    const text = normalizeText(textOf(candidate));
    if (!text || text.length > MARK_OVERLAY_CANDIDATE_MAX_CHARS) continue;
    if (!isVisibleElement(candidate) || seen.has(text)) continue;
    seen.add(text);
    texts.push(text);
  }
  return texts;
}

/** Applied-state texts from this card's hover overlay only. Finding stays card-wide. */
export function overlayAppliedCandidateTexts(root) {
  return overlayCandidateTexts(overlayRoot(root));
}

/** Overlay on this job's card, else that card's Mark Applied container. Never another card. */
export function markStateRoot(html, job = {}) {
  const document = asRoot(html);
  if (!document) return null;
  const card = cardForJob(document, job);
  if (!card) return null;
  const overlay = overlayRoot(card);
  if (overlay) return overlay;
  return findMarkAppliedControl(card)?.parentElement || null;
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
