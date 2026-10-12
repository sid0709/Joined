/** Built In job board: hosts, selectors, storage keys, and crawl pacing. */

export const BUILTIN_HOSTS = ["builtin.com", "www.builtin.com"];
export const BUILTIN_ORIGIN = "https://builtin.com";

export const JOBS_PATH = "/jobs";
export const PAGE_PARAM = "page";
export const MAX_PAGE = 1000;

export const JOB_CARD = 'div[data-id="job-card"]';
export const JOB_CARD_TITLE = "a[data-id=job-card-title]";
export const COMPANY_TITLE = "a[data-id=company-title]";
export const COMPANY_LOGO = "img[data-id=company-img]";
export const NEXT_PAGE = '#pagination a[aria-label="Go to Next Page"]';
export const JSON_LD_SCRIPT = 'script[type*="ld"]';
export const JOB_POST_INIT_NAME = "Builtin.jobPostInit";
export const JOB_BOARD_INIT_NAME = "Builtin.jobBoardInit";
export const HEADER_SCOPE = ".match-background";
export const SIMILAR_JOBS = ".job-unbounded-responsive";
export const APPLY_FORM = 'div[x-data="applyForm"]';
export const APPLY_UNAUTH = 'a[data-builtin-track-click-event="job_apply_unauth"]';
export const SAVED_TAG = 'span[x-show="showSavedTag === true"]';
export const SKILLS_HEADING = "h2";
export const SKILLS_HEADING_TEXT = "Skills Required";
export const JOB_BODY_ID_PREFIX = "job-post-body-";

export const ICON_LOCATION = ".fa-location-dot";
export const ICON_WORKPLACE = ".fa-house-building";
export const ICON_SENIORITY = ".fa-trophy";
export const ICON_SALARY = ".fa-sack-dollar";
export const ICON_POSTED = ".fa-clock";

export const HANDLED_STORAGE_KEY = "builtinHandledJobIdsV1";
export const CURSOR_STORAGE_KEY = "builtinCrawlCursorV1";

/** Jittered pause between opening jobs. */
export const JOB_DELAY_MS = Object.freeze({ min: 1500, max: 4000 });
/** Longer pause after a list page is exhausted. */
export const PAGE_DELAY_MS = Object.freeze({ min: 4000, max: 8000 });

export const EASY_APPLY_TAG = "Easy Apply";
export const SAVED_TAG_TEXT = "Saved";

export function jitterMs(range, random = Math.random) {
  const span = range.max - range.min;
  return Math.round(range.min + span * random());
}
