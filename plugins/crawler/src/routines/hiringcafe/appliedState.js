import { queryAll, queryOne } from "../../routineKit/extract.js";
import { isVisibleElement } from "../builtin/visible.js";

import {
  APP_TRACKER_TEXT,
  APPLIED_CHECK_RE,
  APPLIED_CHECK_TEXT,
  APPLIED_TOGGLE_TEXT,
  CARD_OVERLAY,
  jobCardSelector,
  jobCardSelectorForJobs,
  MARK_APPLIED_CONTROL,
  MARK_APPLIED_TEXT,
  MARK_OVERLAY_CANDIDATE_MAX_CHARS,
  MARK_TOAST,
  MARK_TOAST_TEXT,
  SIGN_IN_DIALOG,
  SIGN_IN_DIALOG_RE,
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
  return (candidates ?? []).some((value) => {
    const text = normalizeText(value);
    if (!text) return false;
    if (text === MARK_APPLIED_TEXT) return false;
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

export function hasMarkAppliedControl(root) {
  return Boolean(findMarkAppliedControl(root));
}

export function hasMarkToast(html) {
  if (!html) return false;
  const document = documentFromHtml(html);
  return queryAll(document, MARK_TOAST).some((node) =>
    normalizeText(textOf(node)).includes(MARK_TOAST_TEXT),
  );
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
  const overlay = card ? queryOne(card, CARD_OVERLAY) || card : null;
  const marked =
    Boolean(overlay && hasAppliedState(overlay)) || Boolean(card && hasAppliedState(card));
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

export function stageUpdateSucceeded(hits = []) {
  return hits.some((hit) => {
    const url = String(hit?.url || "");
    const body = String(hit?.body || "");
    return (
      url.includes("/api/updateMarketplaceJobStageForUser") &&
      hit?.status === 200 &&
      /update successful/i.test(body)
    );
  });
}

export function markConfirmed({ applied, tracker, toast, fetchOk }) {
  return Boolean(applied || tracker || toast || fetchOk);
}
