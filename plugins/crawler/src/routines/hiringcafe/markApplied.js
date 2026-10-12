import {
  appliedStateFromHtml,
  cardSelectorForJob,
  hasAppliedCheck,
  hasMarkAppliedControl,
  hasMarkToast,
  isHiringCafeSignedOut,
  markConfirmed,
  stageUpdateSucceeded,
} from "./appliedState.js";
import {
  alreadyMarkedLog,
  carouselShowSelector,
  CAROUSEL_NEXT,
  JOB_LINK,
  MARK_APPLIED,
  MARK_APPLIED_LABEL,
  MARK_APPLIED_TEXT,
  MARK_APPLIED_WAIT_MS,
  MARK_CONFIRM_MS,
  MARK_HOVER_MS,
  MARK_HOVER_OFFSETS,
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

function noteMark(onActivity, label, kind = "waitFor") {
  onActivity?.({ phase: "dismiss", label, kind });
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

async function hoverUntilOverlay({ job, call, rest, skipDelays, readPage, selector }) {
  let last = { found: false };
  for (const offset of MARK_HOVER_OFFSETS) {
    last = await hoverCard(call, selector, offset).catch(() => ({ found: false }));
    await pause(rest, skipDelays, MARK_HOVER_MS);
    const page = await readPage();
    const state = appliedStateFromHtml(page.html, job);
    if (state.canMark || state.marked) return { hovered: last, state, page };
  }
  const page = await readPage();
  return { hovered: last, state: appliedStateFromHtml(page.html, job), page };
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
  const { hovered, state, page } = await hoverUntilOverlay({
    job,
    call,
    rest,
    skipDelays,
    readPage,
    selector,
  });
  if (isHiringCafeSignedOut(page.html)) {
    return { found: Boolean(hovered?.found), marked: false, signedOut: true, page };
  }
  return { ...state, signedOut: state.signedOut, page };
}

async function confirmAfterClick({ job, call, rest, skipDelays, readPage }) {
  await pause(rest, skipDelays, MARK_CONFIRM_MS);
  const hits = await stageUpdateHits(call);
  const fetchOk = stageUpdateSucceeded(hits);
  let page = await readPage();
  const toast = hasMarkToast(page.html);
  if (isHiringCafeSignedOut(page.html)) {
    return { marked: false, signedOut: true, toast, fetchOk };
  }
  await hoverCard(call, exactCardSelector(job));
  await pause(rest, skipDelays, MARK_HOVER_MS);
  page = await readPage();
  const cardApplied = appliedStateFromHtml(page.html, job).marked;
  const marked = markConfirmed({ applied: cardApplied, toast, fetchOk });
  return {
    marked,
    signedOut: isHiringCafeSignedOut(page.html),
    toast,
    fetchOk,
    applied: cardApplied,
  };
}

/**
 * Hover the specific grouped job's card, click Mark Applied only when the
 * overlay is not already Applied ✓, then confirm via toast, the stage API
 * 200, or Applied ✓ on that one card.
 */
export async function markAppliedOnCard({
  job,
  call,
  rest,
  skipDelays = false,
  onActivity,
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
    noteMark(onActivity, log);
    console.warn(log);
    return { marked: false, log, reason: NOT_MARKED_REASON.NO_SELECTOR };
  }
  const ready = await readAppliedOnCard({ job, call, rest, skipDelays, readPage });
  if (ready.signedOut) {
    noteMark(onActivity, SIGN_IN_TO_MARK_MESSAGE);
    return { marked: false, signedOut: true, log: SIGN_IN_TO_MARK_MESSAGE };
  }
  if (ready.marked) {
    const log = alreadyMarkedLog(jobId);
    noteMark(onActivity, log);
    return { marked: true, already: true, log };
  }
  if (!ready.canMark) {
    const log = notMarkedLog(jobId, NOT_MARKED_REASON.HOVER_MISSED);
    noteMark(onActivity, log);
    console.warn(log);
    return { marked: false, log, reason: NOT_MARKED_REASON.HOVER_MISSED };
  }

  noteMark(onActivity, MARK_APPLIED_LABEL, "click");
  await watchStageUpdate(call);
  const clicked = await call("click", {
    selector: `${exactCardSelector(job)} ${MARK_APPLIED}`,
    contains: MARK_APPLIED_TEXT,
    exact: true,
    wait: skipDelays ? 0 : MARK_APPLIED_WAIT_MS,
  });
  if (!clicked?.found) {
    const log = notMarkedLog(jobId, NOT_MARKED_REASON.CLICK_MISSED);
    noteMark(onActivity, log);
    console.warn(log);
    return { marked: false, log, reason: NOT_MARKED_REASON.CLICK_MISSED };
  }
  const confirmed = await confirmAfterClick({ job, call, rest, skipDelays, readPage });
  if (confirmed.signedOut) {
    noteMark(onActivity, SIGN_IN_TO_MARK_MESSAGE);
    return { marked: false, signedOut: true, log: SIGN_IN_TO_MARK_MESSAGE };
  }
  if (confirmed.marked) {
    const log = markedAppliedLog(jobId);
    noteMark(onActivity, log);
    return { marked: true, log };
  }
  const log = notMarkedLog(jobId, NOT_MARKED_REASON.NOT_CONFIRMED);
  noteMark(onActivity, log);
  console.warn(log, { found: clicked?.found, toast: confirmed.toast, fetchOk: confirmed.fetchOk });
  return { marked: false, log, reason: NOT_MARKED_REASON.NOT_CONFIRMED };
}

/**
 * Detail-page Mark Applied is unverified on the live map. Use it when the
 * control or Applied ✓ is actually on the page; otherwise the caller falls
 * back to the list-card carousel.
 */
export async function markAppliedOnDetail({
  job,
  call,
  rest,
  skipDelays = false,
  onActivity,
  readPage,
  enabled,
} = {}) {
  const jobId = job?.id || "";
  if (!isMarkAppliedEnabled(enabled) || !jobId) {
    return { marked: false, skipped: true, via: "detail", log: "" };
  }
  const page = await readPage();
  if (isHiringCafeSignedOut(page.html)) {
    return { marked: false, signedOut: true, via: "detail", log: SIGN_IN_TO_MARK_MESSAGE };
  }
  if (hasAppliedCheck(page.html)) {
    const log = alreadyMarkedLog(jobId);
    noteMark(onActivity, log);
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
  const confirmed = await confirmAfterClick({ job, call, rest, skipDelays, readPage });
  if (confirmed.signedOut) {
    noteMark(onActivity, SIGN_IN_TO_MARK_MESSAGE);
    return { marked: false, signedOut: true, via: "detail", log: SIGN_IN_TO_MARK_MESSAGE };
  }
  if (confirmed.marked) {
    const log = markedAppliedLog(jobId);
    noteMark(onActivity, log);
    return { marked: true, via: "detail", log };
  }
  const log = notMarkedLog(jobId, NOT_MARKED_REASON.NOT_CONFIRMED);
  noteMark(onActivity, log);
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
 * Applied ✓ and do not click again (a second click can undo the mark).
 */
export async function resolveMarkAfterDetail(detailMark, options) {
  if (detailMark?.signedOut) return detailMark;
  if (detailMark?.marked || detailMark?.already) return detailMark;
  if (detailClickedNothing(detailMark)) return markAppliedOnCard(options);
  const ready = await readAppliedOnCard(options);
  if (ready.signedOut) {
    return { marked: false, signedOut: true, via: "reread", log: SIGN_IN_TO_MARK_MESSAGE };
  }
  if (ready.marked) {
    const log = alreadyMarkedLog(options?.job?.id || "");
    noteMark(options?.onActivity, log);
    return { marked: true, already: true, via: "reread", log };
  }
  return {
    ...detailMark,
    reason: detailMark?.reason || NOT_MARKED_REASON.NOT_CONFIRMED,
  };
}

export async function markAppliedForJob(options) {
  if (!isMarkAppliedEnabled(options?.enabled)) {
    return { marked: false, skipped: true, log: "" };
  }
  return resolveMarkAfterDetail(await markAppliedOnDetail(options), options);
}
