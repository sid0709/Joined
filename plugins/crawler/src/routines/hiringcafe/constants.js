/** HiringCafe job board: live-confirmed hosts, selectors, and crawl pacing. */

import { cssEscape } from "./cssEscape.js";

export const HIRINGCAFE_HOSTS = ["hiringcafe.com", "www.hiringcafe.com", "hiring.cafe"];
export const HIRINGCAFE_ORIGIN = "https://hiringcafe.com";

export const CLASSIC_PATH = "/classic";
export const JOB_PATH = "/job/";
export const PAGE_PARAM = "page";
export const SEARCH_STATE_PARAM = "searchState";
export const FIRST_PAGE_INDEX = 0;
export const MAX_PAGE = 1000;

/** List cards. Prefer `__NEXT_DATA__.props.pageProps.ssrHits` over these; groups share a card. */
export const JOB_RESULTS = '[data-testid="job-results"]';
export const JOB_CARD = '[data-testid="job-results"] .hc-card-grid > div';
export const JOB_LINK = 'a[href^="/job/"]';
export const NEXT_DATA_SCRIPT = "#__NEXT_DATA__";
export const JSON_LD_SCRIPT = 'script[type*="ld"]';
export const TITLE_HEADING = "h1";
export const POSTED_CHIP = "div.absolute.top-2.right-2 span";
export const POSTED_TEXT_RE = /posted\s+.+/i;

export const NEXT_PAGE = 'button[aria-label="Next page"], a[aria-label="Next page"]';
export const CARD_OVERLAY = "div.absolute.top-0.right-0";
/** Live overlay is a `<button class="bg-white">`, not only `div.bg-white`. */
export const MARK_APPLIED_CONTROL = "button, div, span, p, a";
export const MARK_APPLIED = `${CARD_OVERLAY} ${MARK_APPLIED_CONTROL}`;
export const MARK_APPLIED_TEXT = "Mark Applied";
export const MARK_OVERLAY_CANDIDATE_MAX_CHARS = 40;
export const APPLIED_CHECK_TEXT = "Applied ✓";
export const APPLIED_CHECK_RE = /applied\s*✓/i;
export const MARK_TOAST_TEXT = "Job marked successfully";
export const MARK_TOAST = '[role="status"], [role="alert"], [class*="toast"]';
export const APP_TRACKER_TEXT = "App Tracker";
export const UPDATE_STAGE_PATH = "/api/updateMarketplaceJobStageForUser";
export const UPDATE_STAGE_OK = "Update successful";
export const CAROUSEL_NEXT = 'button[aria-label="Next job at this company"]';
export const CAROUSEL_PREV = 'button[aria-label="Previous job at this company"]';
export const MARK_HOVER_OFFSET = Object.freeze({ x: 100, y: 100 });
export const MARK_HOVER_OFFSETS = Object.freeze([
  Object.freeze({ x: 100, y: 100 }),
  Object.freeze({ x: 40, y: 36 }),
  Object.freeze({ x: 220, y: 36 }),
]);

/** Mark Applied is on by default; the Run panel persists the opposite choice. */
export const MARK_APPLIED_DEFAULT = true;
export const MARK_APPLIED_STORAGE_KEY = "hiringcafeMarkAppliedEnabledV1";
export const MARK_HOVER_MS = 250;
export const MARK_HOVER_STEPS = 4;
export const SCROLL_SETTLE_MS = 50;
export const MARK_OVERLAY_WAIT_MS = 1_500;
export const MARK_OVERLAY_POLL_MS = 50;
export const MARK_CONFIRM_MS = 1_000;
export const MARK_APPLIED_WAIT_MS = 1_000;
export const MARK_APPLIED_LABEL = "Mark Applied";
export const SIGN_IN_TO_MARK_MESSAGE =
  "Sign in to HiringCafe to Mark Applied. The crawl pauses until you do.";
export const SIGN_IN_TRACKER_TEXT = "Sign in so we can update your job tracker";
export const SIGN_IN_DIALOG_RE = /sign in|log in|continue with/i;
export const SIGN_IN_DIALOG = '[role="dialog"], [aria-modal="true"], dialog';
export const TURNSTILE_WIDGET =
  '.cf-turnstile, [data-cf-turnstile], iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]';
export const CHALLENGE_TITLE_RE = /just a moment|attention required|verify you are (a )?human/i;

export function carouselShowSelector(index) {
  return `button[aria-label="Show job ${index}"]`;
}

export const HANDLED_STORAGE_KEY = "hiringcafeHandledJobIdsV1";
export const CURSOR_STORAGE_KEY = "hiringcafeCrawlCursorV1";
export const HANDLED_MAX_IDS = 50_000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const HANDLED_MAX_AGE_DAYS = 90;
export const HANDLED_MAX_AGE_MS = HANDLED_MAX_AGE_DAYS * MS_PER_DAY;

export const JOB_DELAY_MS = Object.freeze({ min: 1500, max: 4000 });
export const PAGE_DELAY_MS = Object.freeze({ min: 4000, max: 8000 });
export const NAVIGATE_WAIT_MS = 8_000;
export const DETAIL_READY_MS = 6_000;
export const DETAIL_READY_POLL_MS = 200;
export const CHALLENGE_POLL_MS = 1_000;
export const RETRY_PAUSE_MS = 400;
export const CARD_DOT = 'button[aria-label^="Show job "]';
export const VIEW_ALL_TEXT = "View all";
export const VIEW_ALL_CONTROL = "button";
export const VIEW_ALL_PANEL =
  '[role="dialog"], [aria-modal="true"], dialog, [data-testid="view-all"]';
export const INVALID_STREAK = 5;
export const INVALID_STREAK_MESSAGE =
  "HiringCafe returned 5 incomplete jobs in a row. Crawl stopped.";
export const STUCK_PAGE_FAILURES = 3;

export function stuckPageMessage(count = STUCK_PAGE_FAILURES) {
  return `The same HiringCafe page failed ${count} times. Crawl stopped.`;
}

export const START_PAGE_KEY = "hiringcafe:start";
export const START_FROM_PAGE_ONE_LABEL = "Start from page 1";
export const EMPTY_PAGE_ONE_LABEL = "Page 1 has 0 jobs";
export const CHALLENGE_WAIT_LABEL = "Waiting for Cloudflare verification";
export const CHALLENGE_NOTICE = "Complete the Cloudflare check. The crawl continues after it.";
/** Server cap is 64 KiB; stay well under so ingest cannot reject on size. */
export const METADATA_LIMIT_BYTES = 48 * 1024;
export const SERVER_METADATA_LIMIT_BYTES = 64 * 1024;

export const CARD_DECISION_OPENED = "opened";
export const CARD_DECISION_MARK_ONLY = "already ingested, marking applied";
export const CARD_SKIP_HANDLED = "already handled";
export const CARD_SKIP_NO_URL = "no job URL";
export const CARD_SKIP_DETAIL_HANDLED = "job page already handled";
export const CARD_SKIP_ALREADY_APPLIED = "already marked applied";
export const CARD_SKIP_METADATA_SIZE = "metadata too large";
export const CARD_SKIP_INGEST_REJECTED = "ingest rejected";
export const CARD_SKIP_INGEST_TIMEOUT = "ingest timed out";
export const CARD_SKIP_INGEST_NOT_ACCEPTED = "ingest not accepted";

export const POSTED_AT_SOURCE = Object.freeze({
  ESTIMATED_PUBLISH_DATE: "estimated_publish_date",
  JSON_LD: "jsonLd",
  AGO: "ago",
  DOM: "dom",
});

export const NOT_MARKED_REASON = Object.freeze({
  NO_SELECTOR: "no card selector",
  HOVER_MISSED: "hover missed overlay",
  CLICK_MISSED: "Mark Applied click missed",
  NOT_CONFIRMED: "no Applied ✓, toast, or stage 200",
  INGEST_REJECTED: "ingest rejected",
  INGEST_TIMEOUT: "ingest timed out",
  NOT_ACCEPTED: "ingest not accepted",
});

export const COMPENSATION_PERIODS = Object.freeze([
  Object.freeze({
    frequency: "yearly",
    min: "yearly_min_compensation",
    max: "yearly_max_compensation",
    suffix: "/yr",
  }),
  Object.freeze({
    frequency: "hourly",
    min: "hourly_min_compensation",
    max: "hourly_max_compensation",
    suffix: "/hr",
  }),
  Object.freeze({
    frequency: "monthly",
    min: "monthly_min_compensation",
    max: "monthly_max_compensation",
    suffix: "/mo",
  }),
  Object.freeze({
    frequency: "weekly",
    min: "weekly_min_compensation",
    max: "weekly_max_compensation",
    suffix: "/wk",
  }),
  Object.freeze({
    frequency: "daily",
    min: "daily_min_compensation",
    max: "daily_max_compensation",
    suffix: "/day",
  }),
]);

export const BENEFIT_FLAGS = Object.freeze([
  ["401k_matching", "401k matching"],
  ["retirement_plan", "Retirement plan"],
  ["tuition_reimbursement", "Tuition reimbursement"],
  ["generous_parental_leave", "Parental leave"],
  ["visa_sponsorship", "Visa sponsorship"],
  ["relocation_assistance", "Relocation assistance"],
]);

export function displayPage(pageIndex) {
  const index = Number.isInteger(pageIndex) ? pageIndex : FIRST_PAGE_INDEX;
  return index + 1;
}

export function emptyPageLabel(pageIndex) {
  return `Page ${displayPage(pageIndex)} has 0 jobs`;
}

export function resumeLabelFromCursor(cursor) {
  if (!cursor || !Array.isArray(cursor.lists) || !cursor.lists.length) return "";
  const page = displayPage(cursor.page);
  if (cursor.lastJobId) return `Resume from page ${page} · ${cursor.lastJobId}`;
  return `Resume from page ${page}`;
}

export function cardDecisionLabel(jobId, decision) {
  if (decision === CARD_DECISION_OPENED) return `Job ${jobId} opened`;
  if (decision === CARD_SKIP_ALREADY_APPLIED) return `Job ${jobId} skipped (applied)`;
  return `Job ${jobId} skipped: ${decision}`;
}

export function cardInvalidDecision(fields) {
  const names = (fields ?? []).map((field) => String(field).trim()).filter(Boolean);
  return `invalid ${names.join(", ") || "job data"}`;
}

const JOB_ID_FROM_HREF = /\/job\/(?:[^/]*-)?([a-z0-9]+)$/i;

/** Path ending `/job/<slug>-<id>` from a live href. Title slugs are ignored. */
export function jobPathFromHref(href) {
  const raw = String(href || "").trim();
  if (!raw) return "";
  const stripped = raw.split("?")[0].replace(/\/$/, "");
  if (stripped.startsWith(JOB_PATH)) return stripped;
  try {
    const path = new URL(raw, HIRINGCAFE_ORIGIN).pathname.replace(/\/$/, "");
    return path.startsWith(JOB_PATH) ? path : "";
  } catch {
    return "";
  }
}

export function requisitionIdFromHref(href) {
  const path = jobPathFromHref(href);
  if (!path) return "";
  return path.match(JOB_ID_FROM_HREF)?.[1] || "";
}

/** Path ending `/job/<slug>-<id>` from the live card/detail href, then `path`. */
export function jobLinkPath(job) {
  if (!job || typeof job !== "object") return "";
  return jobPathFromHref(job.url || job.href || job.path);
}

/**
 * Card that owns this posting. Built from the card's real href (`cardHref`,
 * then `url`/`href`), not a title-slug `path`. After a grouped carousel the
 * live href changes, so a sibling also matches `href$="-<id>"`.
 */
export function jobCardSelector(job) {
  const path = jobPathFromHref(job?.cardHref || job?.url || job?.href);
  const hrefId = requisitionIdFromHref(path);
  if (!path || !hrefId || !path.endsWith(`-${hrefId}`)) return "";
  const prefix = path.slice(0, path.length - hrefId.length);
  const exact = `${JOB_CARD}:has(a[href$="${prefix}${cssEscape(hrefId)}"])`;
  const id = String(job?.id || "").trim();
  if (!id || id === hrefId) return exact;
  return `${exact}, ${JOB_CARD}:has(a[href$="-${cssEscape(id)}"])`;
}

export function jobCardSelectorForJobs(jobs) {
  return [...new Set((jobs ?? []).map((item) => jobCardSelector(item)).filter(Boolean))].join(", ");
}

export function markedCountLabel(marked = 0, notMarked = 0, skippedApplied = 0) {
  return `${marked} marked · ${notMarked} not marked · ${skippedApplied} skipped (applied)`;
}

export function markedReasonsLabel(reasons = []) {
  const unique = [
    ...new Set((reasons ?? []).map((reason) => String(reason || "").trim()).filter(Boolean)),
  ];
  return unique.join(" · ");
}

export function markedAppliedLog(jobId) {
  return `Job ${jobId} marked applied`;
}

export function alreadyMarkedLog(jobId) {
  return `Job ${jobId} already marked applied`;
}

export function notMarkedLog(jobId, reason = "", diagnostics = "") {
  const detail = String(reason || "").trim();
  const extra = String(diagnostics || "").trim();
  const base = detail
    ? `Job ${jobId} not marked applied: ${detail}`
    : `Job ${jobId} not marked applied`;
  return extra ? `${base} · ${extra}` : base;
}

export function groupShortfallLabel(collapseKey, captured, dots) {
  return `HiringCafe group ${collapseKey || "card"} captured ${captured} jobs but the card shows ${dots} dots`;
}

export function jitterMs(range, random = Math.random) {
  const span = range.max - range.min;
  return Math.round(range.min + span * random());
}
