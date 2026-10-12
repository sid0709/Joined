import { JOB_POST_INIT_NAME, TITLE_HEADING } from "./constants.js";
import { documentFromHtml, textOf } from "./html.js";
import { parseJobPostingJsonLd, parseJobPostInit } from "./parseInit.js";

/**
 * A job page is ready to scrape when jobPostInit, a JSON-LD JobPosting, and
 * the h1 have landed. tabs `complete` can fire before those scripts.
 */
export function isJobDetailReady(html) {
  if (!html) return false;
  if (!parseJobPostInit(html) && !String(html).includes(JOB_POST_INIT_NAME)) return false;
  if (!parseJobPostingJsonLd(html)) return false;
  const heading = documentFromHtml(html).querySelector(TITLE_HEADING);
  return Boolean(textOf(heading));
}
