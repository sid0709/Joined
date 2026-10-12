/** HiringCafe job board: live-confirmed hosts, selectors, and crawl pacing. */

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
export const MARK_APPLIED = "div.absolute.top-0.right-0 div";
export const MARK_APPLIED_TEXT = "Mark Applied";

/**
 * TODO: Mark Applied is a hover-only overlay that needs sign-in. Persistence,
 * undo, and the signed-in DOM are unverified. Keep this off until confirmed.
 */
export const MARK_APPLIED_ENABLED = false;

export const HANDLED_STORAGE_KEY = "hiringcafeHandledJobIdsV1";
export const CURSOR_STORAGE_KEY = "hiringcafeCrawlCursorV1";
export const HANDLED_MAX_IDS = 50_000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const HANDLED_MAX_AGE_DAYS = 90;
export const HANDLED_MAX_AGE_MS = HANDLED_MAX_AGE_DAYS * MS_PER_DAY;

export const JOB_DELAY_MS = Object.freeze({ min: 1500, max: 4000 });
export const PAGE_DELAY_MS = Object.freeze({ min: 4000, max: 8000 });
export const NAVIGATE_WAIT_MS = 15_000;
export const DETAIL_READY_MS = 10_000;
export const DETAIL_READY_POLL_MS = 200;
export const CHALLENGE_POLL_MS = 1_000;
export const RETRY_PAUSE_MS = 1_000;
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

export const CARD_DECISION_OPENED = "opened";
export const CARD_SKIP_HANDLED = "already handled";
export const CARD_SKIP_NO_URL = "no job URL";
export const CARD_SKIP_DETAIL_HANDLED = "job page already handled";

export const FAVICON_ORIGIN = "https://s2.googleusercontent.com";
export const FAVICON_PATH = "/s2/favicons";
export const FAVICON_DOMAIN_PARAM = "domain";
export const FAVICON_SIZE_PARAM = "sz";
export const FAVICON_SIZE = 128;
export const COMPANY_PATH = "/company/";

export const POSTED_AT_SOURCE = Object.freeze({
  ESTIMATED_PUBLISH_DATE: "estimated_publish_date",
  JSON_LD: "jsonLd",
  DOM: "dom",
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

export function resumeLabelFromCursor(cursor) {
  if (!cursor || !Array.isArray(cursor.lists) || !cursor.lists.length) return "";
  const page = displayPage(cursor.page);
  if (cursor.lastJobId) return `Resume from page ${page} · ${cursor.lastJobId}`;
  return `Resume from page ${page}`;
}

export function cardDecisionLabel(jobId, decision) {
  if (decision === CARD_DECISION_OPENED) return `Job ${jobId} opened`;
  return `Job ${jobId} skipped: ${decision}`;
}

export function cardInvalidDecision(fields) {
  const names = (fields ?? []).map((field) => String(field).trim()).filter(Boolean);
  return `invalid ${names.join(", ") || "job data"}`;
}

export function jitterMs(range, random = Math.random) {
  const span = range.max - range.min;
  return Math.round(range.min + span * random());
}
