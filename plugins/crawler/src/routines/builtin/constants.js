/** Built In job board: live-confirmed selectors, hosts, and crawl pacing. */

export const BUILTIN_HOSTS = ["builtin.com", "www.builtin.com"];
export const BUILTIN_ORIGIN = "https://builtin.com";

export const JOBS_PATH = "/jobs";
export const PAGE_PARAM = "page";
export const MAX_PAGE = 1000;

/** List cards: `div[data-id=job-card]#job-card-<id>`. Do not click the title (target=_blank). */
export const JOB_CARD = 'div[data-id="job-card"][id^="job-card-"]';
export const JOB_CARD_ID_PREFIX = "job-card-";
export const JOB_CARD_DATA_ID = "job-card";
export const JOB_CARD_TITLE = 'a[data-id="job-card-title"]';
export const COMPANY_TITLE = 'a[data-id="company-title"]';
export const COMPANY_LOGO = 'img[data-id="company-img"]';
export const COMPANY_PROFILE_LINK = 'a[href^="/company/"]';
export const NEXT_PAGE = '#pagination a[aria-label="Go to Next Page"]';
export const PREV_PAGE = '#pagination a[aria-label="Go to Previous Page"]';

/** List-card heart: open shadowRoot on `my-item`, inner `div.heart`. Never the job-page Save. */
export const SAVE_HOST = 'my-item[entity-type="job"]';
export const HEART_INNER = "div.heart";
export const HEART_SAVED_CLASS = "saved";
export const HEART_PREFIX_SAVED = "fas";
export const HEART_PREFIX_UNSAVED = "far";
/** After reload, a saved card drops `my-item` and shows this pink badge. */
export const SAVED_BADGE = 'span[x-show="showSavedTag === true"]';
export const SAVED_BADGE_TEXT = "Saved";
export const CLOAK_ATTR = "x-cloak";
export const DISPLAY_NONE_RE = /display\s*:\s*none/i;
export const VISIBILITY_HIDDEN_RE = /visibility\s*:\s*hidden/i;
export const JOB_PAGE_SAVE = 'button:has([data-id="heart-button"])';
export const APPLY_BUTTON = 'a[aria-label="Apply to job"]';

export const JSON_LD_SCRIPT = 'script[type*="ld"]';
export const JOB_POST_INIT_NAME = "Builtin.jobPostInit";
export const JOB_BOARD_INIT_NAME = "Builtin.jobBoardInit";
export const TITLE_HEADING = "h1";
export const HEADER_SCOPE = ".job-post-item .match-background";
export const JOB_POST_ITEM = ".job-post-item";
export const ICON_HQ = ".fa-map-location-dot";
export const ICON_EMPLOYEES = ".fa-user-group";
export const ICON_FOUNDED = ".fa-calendar";
export const SIMILAR_JOBS = ".job-unbounded-responsive";
export const APPLY_FORM = 'div[x-data="applyForm"]';
export const APPLY_UNAUTH = 'a[data-builtin-track-click-event="job_apply_unauth"]';
export const APPLY_REDIRECT_PARAM = "handler";
export const APPLY_REDIRECT_VALUE = "ApplyRedirect";
export const JOB_BODY_ID_PREFIX = "job-post-body-";
export const JOB_BODY = '[id^="job-post-body-"]';

export const ICON_LOCATION = ".fa-location-dot";
export const ICON_WORKPLACE = ".fa-house-building";
export const ICON_SENIORITY = ".fa-trophy";
export const ICON_SALARY = ".fa-sack-dollar";
export const ICON_POSTED = ".fa-clock";

export const HANDLED_STORAGE_KEY = "builtinHandledJobIdsV1";
export const CURSOR_STORAGE_KEY = "builtinCrawlCursorV1";
export const HANDLED_MAX_IDS = 50_000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const HANDLED_MAX_AGE_DAYS = 90;
export const HANDLED_MAX_AGE_MS = HANDLED_MAX_AGE_DAYS * MS_PER_DAY;

export const JOB_DELAY_MS = Object.freeze({ min: 1500, max: 4000 });
export const PAGE_DELAY_MS = Object.freeze({ min: 4000, max: 8000 });
export const NAVIGATE_WAIT_MS = 15_000;
export const DETAIL_READY_MS = 10_000;
export const DETAIL_READY_POLL_MS = 200;
export const HEART_CONFIRM_MS = 5_000;
export const HEART_POLL_MS = 200;
export const HEART_TARGET_WAIT_MS = 1_500;
export const HEART_CLICK_HEART = "heart";
export const HEART_CLICK_SVG = "svg";
export const HEART_CLICK_HOST = "host";
export const HEART_CLICK_TARGETS = Object.freeze([
  HEART_CLICK_HEART,
  HEART_CLICK_SVG,
  HEART_CLICK_HOST,
]);
export const HEART_UNREAD_LABEL = "Skipping list-card heart; shadow state could not be read";
export const HEART_NOT_SAVED_LABEL = "heart not saved";
export const EMPTY_PAGE_ONE_LABEL = "Page 1 has 0 cards";
export const INVALID_STREAK = 5;
export const INVALID_STREAK_MESSAGE =
  "Built In returned 5 incomplete jobs in a row. Crawl stopped.";
export const CARD_DECISION_OPENED = "opened";
export const CARD_SKIP_HANDLED = "already handled";
export const CARD_SKIP_HEART_SAVED = "list-card heart already saved";
export const CARD_SKIP_SAVED_BADGE = "visible Saved badge";
export const CARD_SKIP_NO_URL = "no job URL";
export const CARD_SKIP_DETAIL_SAVED = "job page already saved";
export const SIGN_IN_TO_SAVE_MESSAGE = "Sign in to Built In to save jobs";
export const SIGN_UP_MODAL_TEXT = "Sign up now. Access later.";
export const RETRY_PAUSE_MS = 1_000;
export const STUCK_LOGIN_STREAK = 3;
export const STUCK_PAGE_FAILURES = 3;
export const STUCK_LOGIN_MESSAGE = "Built In redirected to sign-in repeatedly. Crawl stopped.";

export function stuckPageMessage(count = STUCK_PAGE_FAILURES) {
  return `The same Built In page failed ${count} times. Crawl stopped.`;
}

export const EASY_APPLY_TAG = "Easy Apply";
export const LOGIN_PATH_PREFIX = "/auth/login";

/** Debug activity line for every list-card decision. */
export function cardDecisionLabel(cardId, decision) {
  if (decision === CARD_DECISION_OPENED) return `Card ${cardId} opened`;
  return `Card ${cardId} skipped: ${decision}`;
}

export function cardInvalidDecision(fields) {
  const names = (fields ?? []).map((field) => String(field).trim()).filter(Boolean);
  return `invalid ${names.join(", ") || "job data"}`;
}

export function jitterMs(range, random = Math.random) {
  const span = range.max - range.min;
  return Math.round(range.min + span * random());
}
