import { attrMatch } from "../../routineKit/extract.js";

/** Built In job board: hosts, Inspector patterns (data-id / id prefix), and crawl pacing. */

export const BUILTIN_HOSTS = ["builtin.com", "www.builtin.com"];
export const BUILTIN_ORIGIN = "https://builtin.com";

export const JOBS_PATH = "/jobs";
export const PAGE_PARAM = "page";
export const MAX_PAGE = 1000;

export const JOB_CARD = attrMatch({ tag: "div", attr: "id", pattern: "job-card-?" });
export const JOB_CARD_TITLE = attrMatch({ tag: "a", attr: "data-id", pattern: "job-card-title" });
export const COMPANY_TITLE = attrMatch({ tag: "a", attr: "data-id", pattern: "company-title" });
export const COMPANY_LOGO = attrMatch({ tag: "img", attr: "data-id", pattern: "company-img" });
export const NEXT_PAGE = '#pagination a[aria-label="Go to Next Page"]';
export const JSON_LD_SCRIPT = 'script[type*="ld"]';
export const JOB_POST_INIT_NAME = "Builtin.jobPostInit";
export const JOB_BOARD_INIT_NAME = "Builtin.jobBoardInit";
export const HEADER_SCOPE = ".job-post-item .match-background";
export const JOB_POST_ITEM = attrMatch({ tag: "div", attr: "class", pattern: "?job-post-item?" });
export const ICON_HQ = ".fa-map-location-dot";
export const ICON_EMPLOYEES = ".fa-user-group";
export const ICON_FOUNDED = ".fa-calendar";
export const SIMILAR_JOBS = ".job-unbounded-responsive";
export const APPLY_FORM = 'div[x-data="applyForm"]';
export const APPLY_UNAUTH = attrMatch({
  tag: "a",
  attr: "data-builtin-track-click-event",
  pattern: "job_apply_unauth",
});
export const APPLY_REDIRECT_PARAM = "handler";
export const APPLY_REDIRECT_VALUE = "ApplyRedirect";
export const SAVED_TAG = 'span[x-show="showSavedTag === true"]';
export const SKILLS_HEADING = "h2";
export const SKILLS_HEADING_TEXT = "Skills Required";
export const JOB_BODY_ID_PREFIX = "job-post-body-";
export const JOB_BODY = attrMatch({ attr: "id", pattern: "job-post-body-?" });

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

export const EASY_APPLY_TAG = "Easy Apply";
export const SAVED_TAG_TEXT = "Saved";

export function jitterMs(range, random = Math.random) {
  const span = range.max - range.min;
  return Math.round(range.min + span * random());
}
