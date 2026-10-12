import {
  appliedStateFromHtml,
  cardSelectorForJob,
  hasAppliedCheck,
  hasMarkAppliedControl,
  hasMarkToast,
  isSignedOutWall,
  markConfirmed,
  stageUpdateSucceeded,
} from "./appliedState.js";
import {
  alreadyMarkedLog,
  carouselShowSelector,
  CAROUSEL_NEXT,
  JOB_LINK,
  MARK_APPLIED,
  MARK_APPLIED_ENABLED,
  MARK_APPLIED_LABEL,
  MARK_APPLIED_TEXT,
  MARK_APPLIED_WAIT_MS,
  MARK_CONFIRM_MS,
  MARK_HOVER_MS,
  MARK_HOVER_OFFSET,
  SIGN_IN_TO_MARK_MESSAGE,
  UPDATE_STAGE_PATH,
  jobCardSelector,
  markedAppliedLog,
  notMarkedLog,
} from "./constants.js";
import { documentFromHtml } from "./html.js";
import { requisitionIdFromHref } from "./parseList.js";
import { readSignedIn } from "./parseNextData.js";

export function isMarkAppliedEnabled() {
  return MARK_APPLIED_ENABLED === true;
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

async function hoverCard(call, selector) {
  return call("hover", { selector, ...MARK_HOVER_OFFSET });
}

function shownRequisitionId(html, job) {
  const document = documentFromHtml(html);
  const card = document.querySelector(cardSelectorForJob(job));
  const href = card?.querySelector?.(JOB_LINK)?.getAttribute("href") || "";
  return requisitionIdFromHref(href);
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
  const selector = jobCardSelector(job.id) || cardSelectorForJob(job);
  await call("scroll", { selector }).catch(() => {});
  const hovered = await hoverCard(call, selector);
  await pause(rest, skipDelays, MARK_HOVER_MS);
  const page = await readPage();
  if (isSignedOutWall(page.html) || readSignedIn(page.html) === false) {
    return { found: Boolean(hovered?.found), marked: false, signedOut: true, page };
  }
  const state = appliedStateFromHtml(page.html, job);
  return { ...state, signedOut: state.signedOut, page };
}

async function confirmAfterClick({ job, call, rest, skipDelays, readPage }) {
  await pause(rest, skipDelays, MARK_CONFIRM_MS);
  const hits = await stageUpdateHits(call);
  const fetchOk = stageUpdateSucceeded(hits);
  let page = await readPage();
  const toast = hasMarkToast(page.html);
  if (isSignedOutWall(page.html)) {
    return { marked: false, signedOut: true, toast, fetchOk };
  }
  await hoverCard(call, jobCardSelector(job.id) || cardSelectorForJob(job));
  await pause(rest, skipDelays, MARK_HOVER_MS);
  page = await readPage();
  const applied = appliedStateFromHtml(page.html, job).marked || hasAppliedCheck(page);
  const marked = markConfirmed({ applied, toast, fetchOk }) || applied;
  return { marked, signedOut: isSignedOutWall(page.html), toast, fetchOk, applied };
}

/**
 * Hover the specific grouped job's card, click Mark Applied only when the
 * overlay is not already Applied ✓, then confirm via toast or the stage API
 * 200 plus an Applied ✓ re-read.
 */
export async function markAppliedOnCard({
  job,
  call,
  rest,
  skipDelays = false,
  onActivity,
  readPage,
} = {}) {
  const jobId = job?.id || "";
  if (!isMarkAppliedEnabled() || !jobId) {
    return { marked: false, log: notMarkedLog(jobId) };
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

  noteMark(onActivity, MARK_APPLIED_LABEL, "click");
  await watchStageUpdate(call);
  const clicked = await call("click", {
    selector: `${jobCardSelector(jobId)} ${MARK_APPLIED}`,
    contains: MARK_APPLIED_TEXT,
    exact: true,
    wait: skipDelays ? 0 : MARK_APPLIED_WAIT_MS,
  });
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
  const log = notMarkedLog(jobId);
  noteMark(onActivity, log);
  console.warn(log, { found: clicked?.found, toast: confirmed.toast, fetchOk: confirmed.fetchOk });
  return { marked: false, log };
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
} = {}) {
  const jobId = job?.id || "";
  const page = await readPage();
  if (isSignedOutWall(page.html) || readSignedIn(page.html) === false) {
    return { marked: false, signedOut: true, via: "detail", log: SIGN_IN_TO_MARK_MESSAGE };
  }
  if (hasAppliedCheck(page)) {
    const log = alreadyMarkedLog(jobId);
    noteMark(onActivity, log);
    return { marked: true, already: true, via: "detail", log };
  }
  if (!hasMarkAppliedControl(page)) {
    return { marked: false, via: "detail", skipped: true, log: "" };
  }
  noteMark(onActivity, MARK_APPLIED_LABEL, "click");
  await watchStageUpdate(call);
  await call("click", {
    selector: MARK_APPLIED,
    contains: MARK_APPLIED_TEXT,
    exact: true,
    wait: skipDelays ? 0 : MARK_APPLIED_WAIT_MS,
  });
  const confirmed = await confirmAfterClick({ job, call, rest, skipDelays, readPage });
  if (confirmed.signedOut) {
    noteMark(onActivity, SIGN_IN_TO_MARK_MESSAGE);
    return { marked: false, signedOut: true, via: "detail", log: SIGN_IN_TO_MARK_MESSAGE };
  }
  const log = confirmed.marked ? markedAppliedLog(jobId) : notMarkedLog(jobId);
  noteMark(onActivity, log);
  return { marked: confirmed.marked, via: "detail", log };
}

export async function markAppliedForJob(options) {
  const fromDetail = await markAppliedOnDetail(options);
  if (fromDetail.signedOut) return fromDetail;
  if (fromDetail.skipped) return markAppliedOnCard(options);
  return fromDetail;
}
