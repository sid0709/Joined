import { queryAll, queryOne } from "../../routineKit/extract.js";

import {
  APPLIED_CHECK_RE,
  APPLIED_CHECK_TEXT,
  CARD_OVERLAY,
  MARK_APPLIED,
  MARK_APPLIED_TEXT,
  MARK_TOAST_TEXT,
  SIGN_IN_DIALOG_RE,
  SIGN_IN_TRACKER_TEXT,
  SIGN_IN_WALL_RE,
  jobCardSelector,
  jobCardSelectorForIds,
} from "./constants.js";
import { documentFromHtml, textOf } from "./html.js";

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
  const ids = job?.groupIds?.length ? job.groupIds : [job?.id || job?.cardJobId].filter(Boolean);
  return jobCardSelectorForIds(ids) || jobCardSelector(job?.id || "");
}

export function cardForJob(document, job) {
  const selector = cardSelectorForJob(job);
  return selector ? queryOne(document, selector) : null;
}

function asRoot(root) {
  if (!root) return null;
  return typeof root === "string" ? documentFromHtml(root) : root;
}

export function hasAppliedCheck(root) {
  const node = asRoot(root);
  if (!node) return false;
  if (APPLIED_CHECK_RE.test(typeof root === "string" ? root : textOf(node))) return true;
  return hasExactText(node, APPLIED_CHECK_TEXT);
}

export function hasMarkAppliedControl(root) {
  const node = asRoot(root);
  if (!node) return false;
  const control = queryOne(node, MARK_APPLIED);
  if (control && normalizeText(textOf(control)) === MARK_APPLIED_TEXT) return true;
  return hasExactText(node, MARK_APPLIED_TEXT);
}

export function hasMarkToast(html) {
  return normalizeText(html).includes(MARK_TOAST_TEXT);
}

export function isSignedOutWall(html) {
  if (!html) return false;
  if (SIGN_IN_WALL_RE.test(html)) return true;
  if (html.includes(SIGN_IN_TRACKER_TEXT)) return true;
  const document = documentFromHtml(html);
  const dialog = queryOne(document, '[role="dialog"], [aria-modal="true"], dialog');
  return Boolean(dialog && SIGN_IN_DIALOG_RE.test(textOf(dialog)));
}

export function appliedStateFromHtml(html, job = {}) {
  const document = documentFromHtml(html);
  const card = cardForJob(document, job) || queryOne(document, CARD_OVERLAY)?.closest("div");
  const overlay = card ? queryOne(card, CARD_OVERLAY) || card : document;
  const marked = hasAppliedCheck(overlay) || hasAppliedCheck(card);
  return {
    found: Boolean(card),
    marked,
    canMark: hasMarkAppliedControl(overlay) || hasMarkAppliedControl(card),
    toast: hasMarkToast(html),
    signedOut: isSignedOutWall(html),
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

export function markConfirmed({ applied, toast, fetchOk }) {
  return Boolean(applied && (toast || fetchOk));
}
