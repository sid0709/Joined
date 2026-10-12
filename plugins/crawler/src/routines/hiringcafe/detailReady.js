import { TITLE_HEADING } from "./constants.js";
import { documentFromHtml, textOf } from "./html.js";
import { hasNextDataJob } from "./parseNextData.js";

/**
 * A job page is ready when `__NEXT_DATA__.props.pageProps.job` and the h1
 * have landed. Tab complete can fire before Next hydrates.
 */
export function isJobDetailReady(html) {
  if (!html || !hasNextDataJob(html)) return false;
  const heading = documentFromHtml(html).querySelector(TITLE_HEADING);
  return Boolean(textOf(heading));
}
