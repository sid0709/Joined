import {
  appliedFromCandidateTexts,
  appliedStateFromHtml,
  cardForJob,
  cardSelectorForJob,
  hasMarkAppliedControl,
  hasMarkToast,
  isHiringCafeSignedOut,
  markConfirmed,
  markStateRoot,
  overlayAppliedCandidateTexts,
  overlayCandidateTexts,
  stageUpdateSucceeded,
} from "./appliedState.js";
import { isHiringCafeChallenge } from "./challenge.js";
import {
  alreadyMarkedLog,
  carouselShowSelector,
  CAROUSEL_NEXT,
  CHALLENGE_WAIT_LABEL,
  JOB_LINK,
  MARK_APPLIED,
  MARK_APPLIED_LABEL,
  MARK_APPLIED_TEXT,
  MARK_APPLIED_WAIT_MS,
  MARK_CONFIRM_MS,
  MARK_HOVER_MS,
  MARK_HOVER_OFFSETS,
  MARK_OVERLAY_POLL_MS,
  MARK_OVERLAY_WAIT_MS,
  NOT_MARKED_REASON,
  SIGN_IN_TO_MARK_MESSAGE,
  UPDATE_STAGE_PATH,
  jobCardSelector,
  markedAppliedLog,
  notMarkedLog,
} from "./constants.js";
import { documentFromHtml } from "./html.js";
import { requisitionIdFromHref } from "./parseList.js";

export function isMarkAppliedEnabled(enabled) {
  return enabled !== false;
}

function noteMark(onActivity, label, kind = "waitFor", onNotice, ok = true) {
  onActivity?.({ phase: "dismiss", label, kind });
  if (ok) {
    onNotice?.(label, true);
    return;
  }
  console.warn(label);
  onNotice?.(label, false);
}

async function pause(rest, skipDelays, ms) {
  if (!skipDelays && typeof rest === "function") await rest(ms);
}

async function watchStageUpdate(call) {
  await call("watchFetch", { urlIncludes: UPDATE_STAGE_PATH }).catch(() => {});
}

async function stageUpdateHits(call) {
  const watched = await call("watchedFetches").catch(() => ({ hits: [] }));
  await call("unwatchFetch").catch(() => {});
  return watched?.hits ?? [];
}

async function hoverCard(call, selector, offset = MARK_HOVER_OFFSETS[0]) {
  return call("hover", { selector, ...offset });
}

function overlayCandidates(...sources) {
  for (const source of sources) {
    const list = source?.candidates || source?.diagnostics?.candidates;
    if (Array.isArray(list) && list.length) return list;
  }
  return [];
}

function appliedCandidatesFromPage(html, job, ...probes) {
  const fromOverlay = overlayAppliedCandidateTexts(cardForJob(documentFromHtml(html), job));
  if (fromOverlay.length) return fromOverlay;
  for (const probe of probes) {
    if (probe?.found) return overlayCandidates(probe);
  }
  return [];
}

function overlayProbe(call, selector, wait = 0) {
  return call("overlayTarget", {
    selector,
    clickSelector: MARK_APPLIED,
    contains: MARK_APPLIED_TEXT,
    exact: true,
    wait,
  }).catch(() => ({ found: false, candidates: [] }));
}

function appliedOverlayState(state, candidates) {
  const already = Boolean(state.marked || appliedFromCandidateTexts(candidates));
  return {
    ...state,
    marked: already,
    canMark: already ? false : state.canMark,
  };
}

async function hoverUntilOverlay({ job, call, rest, skipDelays, readPage, selector }) {
  let last = { found: false };
  for (const offset of MARK_HOVER_OFFSETS) {
    last = await hoverCard(call, selector, offset).catch(() => ({ found: false }));
    const overlay = await overlayProbe(call, selector, skipDelays ? 0 : MARK_OVERLAY_WAIT_MS);
    const page = await readPage();
    const candidates = appliedCandidatesFromPage(page.html, job, overlay);
    const state = appliedOverlayState(appliedStateFromHtml(page.html, job), candidates);
    const overlaySeen = Boolean(overlay?.found || state.canMark || state.marked);
    last = {
      ...last,
      candidates,
      diagnostics: { ...(last.diagnostics || {}), overlay: overlaySeen, candidates },
      diagnosticsText: last.diagnosticsText,
    };
    if (isHiringCafeChallenge(page)) return { hovered: last, state, page };
    if (overlay?.found || state.canMark || state.marked) return { hovered: last, state, page };
    if (skipDelays) continue;
    await pause(rest, skipDelays, MARK_OVERLAY_POLL_MS);
  }
  const page = await readPage();
  const candidates = appliedCandidatesFromPage(page.html, job);
  return {
    hovered: last,
    state: appliedOverlayState(appliedStateFromHtml(page.html, job), candidates),
    page,
  };
}

function shownRequisitionId(html, job) {
  const document = documentFromHtml(html);
  const card = document.querySelector(cardSelectorForJob(job));
  const href = card?.querySelector?.(JOB_LINK)?.getAttribute("href") || "";
  return requisitionIdFromHref(href);
}

function exactCardSelector(job) {
  return jobCardSelector(job) || cardSelectorForJob(job);
}

/**
 * Grouped cards share one DOM node. Show job N (ssrHits order) or step Next
 * until the card href is this requisition_id.
 */
export async function carouselToJob({ job, call, rest, skipDelays = false, readPage } = {}) {
  const selector = cardSelectorForJob(job);
  if (!selector || !job?.id) return { found: false, shownId: "" };
  if ((job.groupSize || 1) > 1 && job.groupIndex) {
    await call("click", {
      selector: `${selector} ${carouselShowSelector(job.groupIndex)}`,
    }).catch(() => {});
    await pause(rest, skipDelays, MARK_HOVER_MS);
  }
  let page = await readPage();
  let shownId = shownRequisitionId(page.html, job);
  if (shownId === job.id) return { found: true, shownId };
  const limit = Math.max(1, job.groupSize || 1);
  for (let step = 0; step < limit && shownId !== job.id; step += 1) {
    await call("click", { selector: `${selector} ${CAROUSEL_NEXT}` }).catch(() => {});
    await pause(rest, skipDelays, MARK_HOVER_MS);
    page = await readPage();
    shownId = shownRequisitionId(page.html, job);
  }
  return { found: shownId === job.id, shownId };
}

/**
 * Park the trusted mouse off the cards, then read the shown job's dimmed card
 * body. Null when the card is still hovered or has no live body, so the
 * caller falls back to the hover overlay.
 */
async function readWithoutHover({ job, call, rest, skipDelays, readPage }) {
  await call("unhover").catch(() => {});
  await pause(rest, skipDelays, MARK_HOVER_MS);
  const page = await readPage();
  if (isHiringCafeChallenge(page)) return { found: false, marked: false, challenge: true, page };
  if (isHiringCafeSignedOut(page.html)) {
    return { found: false, marked: false, signedOut: true, page };
  }
  const state = appliedStateFromHtml(page.html, job);
  if (state.dimmed == null) return null;
  return { ...state, page, hovered: { found: state.found } };
}

export async function readAppliedOnCard({
  job,
  call,
  rest,
  skipDelays = false,
  readPage,
  carousel = true,
} = {}) {
  if (carousel) await carouselToJob({ job, call, rest, skipDelays, readPage });
  const selector = exactCardSelector(job);
  await call("scroll", { selector }).catch(() => {});
  const resting = await readWithoutHover({ job, call, rest, skipDelays, readPage });
  if (resting) return resting;
  const { hovered, state, page } = await hoverUntilOverlay({
    job,
    call,
    rest,
    skipDelays,
    readPage,
    selector,
  });
  if (isHiringCafeChallenge(page)) {
    return { found: Boolean(hovered?.found), marked: false, challenge: true, page, hovered };
  }
  if (isHiringCafeSignedOut(page.html)) {
    return { found: Boolean(hovered?.found), marked: false, signedOut: true, page, hovered };
  }
  return { ...state, signedOut: state.signedOut, page, hovered };
}

async function confirmAfterClick({ job, call, rest, skipDelays, readPage, beforeHtml = "" }) {
  await pause(rest, skipDelays, MARK_CONFIRM_MS);
  const hits = await stageUpdateHits(call);
  const fetchOk = stageUpdateSucceeded(hits, job);
  let page = await readPage();
  const toast = hasMarkToast(page.html, beforeHtml);
  if (isHiringCafeSignedOut(page.html)) {
    return { marked: false, signedOut: true, toast, fetchOk };
  }
  const resting = await readWithoutHover({ job, call, rest, skipDelays, readPage });
  if (resting?.marked) {
    return { marked: true, signedOut: false, toast, fetchOk, applied: true };
  }
  const selector = exactCardSelector(job);
  await hoverCard(call, selector);
  await pause(rest, skipDelays, MARK_HOVER_MS);
  page = await readPage();
  const overlay = await overlayProbe(call, selector);
  const candidates = appliedCandidatesFromPage(page.html, job, overlay);
  const cardApplied = appliedOverlayState(appliedStateFromHtml(page.html, job), candidates).marked;
  const marked = markConfirmed({
    applied: cardApplied,
    tracker: cardApplied,
    toast,
    fetchOk,
  });
  return {
    marked,
    signedOut: isHiringCafeSignedOut(page.html),
    toast,
    fetchOk,
    applied: cardApplied,
  };
}

async function clickMarkOnCard({ job, call, skipDelays }) {
  const selector = exactCardSelector(job);
  const wait = skipDelays ? 0 : MARK_APPLIED_WAIT_MS;
  await call("scroll", { selector }).catch(() => {});
  let hovered;
  try {
    hovered = await call("hoverClick", {
      selector,
      clickSelector: MARK_APPLIED,
      contains: MARK_APPLIED_TEXT,
      exact: true,
      offsets: MARK_HOVER_OFFSETS,
      wait,
      overlayWait: skipDelays ? 0 : MARK_OVERLAY_WAIT_MS,
    });
  } catch {
    // A press may have already POSTed; do not click again.
    return { found: true, hovered: true, pressed: true };
  }
  const candidates = overlayCandidates(hovered);
  if (appliedFromCandidateTexts(candidates)) {
    return {
      ...hovered,
      candidates,
      found: Boolean(hovered?.found || hovered?.pressed),
      already: true,
    };
  }
  if (hovered?.found || hovered?.pressed) return { ...hovered, candidates, found: true };
  // Never click a second time. The overlay is a toggle; a retry un-applies.
  return { ...hovered, candidates, found: false };
}

/**
 * Hover the specific grouped job's card and click Mark Applied in the same
 * turn (the overlay is hover-only). Confirm via toast, the stage API 200,
 * Applied / App Tracker, or the toggle flipping to Applied. Click once.
 */
export async function markAppliedOnCard({
  job,
  call,
  rest,
  skipDelays = false,
  onActivity,
  onNotice,
  readPage,
  enabled,
} = {}) {
  const jobId = job?.id || "";
  if (!isMarkAppliedEnabled(enabled) || !jobId) {
    const log = notMarkedLog(jobId, NOT_MARKED_REASON.NO_SELECTOR);
    return { marked: false, log, reason: NOT_MARKED_REASON.NO_SELECTOR };
  }
  if (!exactCardSelector(job)) {
    const log = notMarkedLog(jobId, NOT_MARKED_REASON.NO_SELECTOR);
    noteMark(onActivity, log, "waitFor", onNotice, false);
    return { marked: false, log, reason: NOT_MARKED_REASON.NO_SELECTOR };
  }
  const ready = await readAppliedOnCard({ job, call, rest, skipDelays, readPage });
  if (ready.challenge) {
    noteMark(onActivity, CHALLENGE_WAIT_LABEL);
    return { marked: false, challenge: true, log: CHALLENGE_WAIT_LABEL };
  }
  if (ready.signedOut) {
    noteMark(onActivity, SIGN_IN_TO_MARK_MESSAGE);
    return { marked: false, signedOut: true, log: SIGN_IN_TO_MARK_MESSAGE };
  }
  if (ready.marked) {
    const log = alreadyMarkedLog(jobId);
    noteMark(onActivity, log, "waitFor", onNotice, true);
    return { marked: true, already: true, log };
  }

  noteMark(onActivity, MARK_APPLIED_LABEL, "click");
  await watchStageUpdate(call);
  const clicked = await clickMarkOnCard({ job, call, skipDelays });
  if (clicked?.already && !clicked?.found && !clicked?.pressed) {
    const log = alreadyMarkedLog(jobId);
    noteMark(onActivity, log, "waitFor", onNotice, true);
    return { marked: true, already: true, log };
  }
  if (!clicked?.found) {
    const after = await readPage().catch(() => ready.page);
    if (isHiringCafeChallenge(after) || isHiringCafeChallenge(ready.page)) {
      noteMark(onActivity, CHALLENGE_WAIT_LABEL);
      return { marked: false, challenge: true, log: CHALLENGE_WAIT_LABEL };
    }
    const reason = ready.canMark ? NOT_MARKED_REASON.CLICK_MISSED : NOT_MARKED_REASON.HOVER_MISSED;
    const diagnostics =
      clicked?.diagnosticsText || ready.hovered?.diagnosticsText || ready.diagnosticsText || "";
    const log = notMarkedLog(jobId, reason, diagnostics);
    noteMark(onActivity, log, "waitFor", onNotice, false);
    return { marked: false, log, reason, diagnostics };
  }
  const confirmed = await confirmAfterClick({
    job,
    call,
    rest,
    skipDelays,
    readPage,
    beforeHtml: ready.page?.html || "",
  });
  if (confirmed.signedOut) {
    noteMark(onActivity, SIGN_IN_TO_MARK_MESSAGE);
    return { marked: false, signedOut: true, log: SIGN_IN_TO_MARK_MESSAGE };
  }
  if (confirmed.marked) {
    const log = markedAppliedLog(jobId);
    noteMark(onActivity, log, "waitFor", onNotice, true);
    return { marked: true, log };
  }
  const log = notMarkedLog(jobId, NOT_MARKED_REASON.NOT_CONFIRMED);
  noteMark(onActivity, log, "waitFor", onNotice, false);
  console.warn(log, { found: clicked?.found, toast: confirmed.toast, fetchOk: confirmed.fetchOk });
  return { marked: false, log, reason: NOT_MARKED_REASON.NOT_CONFIRMED };
}

/**
 * Detail-page Mark Applied is unverified on the live map. Use it when the
 * control or Applied state is actually on the page; otherwise the caller
 * falls back to the list-card carousel.
 */
export async function markAppliedOnDetail({
  job,
  call,
  rest,
  skipDelays = false,
  onActivity,
  onNotice,
  readPage,
  enabled,
} = {}) {
  const jobId = job?.id || "";
  if (!isMarkAppliedEnabled(enabled) || !jobId) {
    return { marked: false, skipped: true, via: "detail", log: "" };
  }
  const page = await readPage();
  if (isHiringCafeChallenge(page)) {
    return { marked: false, challenge: true, via: "detail", log: CHALLENGE_WAIT_LABEL };
  }
  if (isHiringCafeSignedOut(page.html)) {
    return { marked: false, signedOut: true, via: "detail", log: SIGN_IN_TO_MARK_MESSAGE };
  }
  const root = markStateRoot(page.html, job);
  if (root && appliedFromCandidateTexts(overlayCandidateTexts(root))) {
    const log = alreadyMarkedLog(jobId);
    noteMark(onActivity, log, "waitFor", onNotice, true);
    return { marked: true, already: true, via: "detail", log };
  }
  if (!hasMarkAppliedControl(page.html)) {
    return { marked: false, via: "detail", skipped: true, log: "" };
  }
  noteMark(onActivity, MARK_APPLIED_LABEL, "click");
  await watchStageUpdate(call);
  const clicked = await call("click", {
    selector: MARK_APPLIED,
    contains: MARK_APPLIED_TEXT,
    exact: true,
    wait: skipDelays ? 0 : MARK_APPLIED_WAIT_MS,
  });
  if (!clicked?.found) {
    return {
      marked: false,
      skipped: true,
      via: "detail",
      reason: NOT_MARKED_REASON.NO_SELECTOR,
      log: "",
    };
  }
  const confirmed = await confirmAfterClick({
    job,
    call,
    rest,
    skipDelays,
    readPage,
    beforeHtml: page.html,
  });
  if (confirmed.signedOut) {
    noteMark(onActivity, SIGN_IN_TO_MARK_MESSAGE);
    return { marked: false, signedOut: true, via: "detail", log: SIGN_IN_TO_MARK_MESSAGE };
  }
  if (confirmed.marked) {
    const log = markedAppliedLog(jobId);
    noteMark(onActivity, log, "waitFor", onNotice, true);
    return { marked: true, via: "detail", log };
  }
  const log = notMarkedLog(jobId, NOT_MARKED_REASON.NOT_CONFIRMED);
  noteMark(onActivity, log, "waitFor", onNotice, false);
  return {
    marked: false,
    via: "detail",
    reason: NOT_MARKED_REASON.NOT_CONFIRMED,
    log,
  };
}

export function detailClickedNothing(result) {
  return Boolean(result?.skipped) || result?.reason === NOT_MARKED_REASON.NO_SELECTOR;
}

/**
 * Card fallback only when detail never clicked. After NOT_CONFIRMED, re-read
 * Applied state and do not click again (a second click can undo the mark).
 */
export async function resolveMarkAfterDetail(detailMark, options) {
  if (detailMark?.signedOut || detailMark?.challenge) return detailMark;
  if (detailMark?.marked || detailMark?.already) return detailMark;
  if (detailClickedNothing(detailMark)) return markAppliedOnCard(options);
  const ready = await readAppliedOnCard(options);
  if (ready.signedOut) {
    return { marked: false, signedOut: true, via: "reread", log: SIGN_IN_TO_MARK_MESSAGE };
  }
  if (ready.marked) {
    const log = alreadyMarkedLog(options?.job?.id || "");
    noteMark(options?.onActivity, log, "waitFor", options?.onNotice, true);
    return { marked: true, already: true, via: "reread", log };
  }
  const reason = detailMark?.reason || NOT_MARKED_REASON.NOT_CONFIRMED;
  const log = detailMark?.log || notMarkedLog(options?.job?.id || "", reason);
  if (!detailMark?.log) noteMark(options?.onActivity, log, "waitFor", options?.onNotice, false);
  return { ...detailMark, reason, log };
}

export async function markAppliedForJob(options) {
  if (!isMarkAppliedEnabled(options?.enabled)) {
    return { marked: false, skipped: true, log: "" };
  }
  return resolveMarkAfterDetail(await markAppliedOnDetail(options), options);
}
