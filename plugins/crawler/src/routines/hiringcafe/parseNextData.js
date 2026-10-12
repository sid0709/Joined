import { parseJobPostingJsonLd } from "../../routineKit/jsonLd.js";

import { NEXT_DATA_SCRIPT } from "./constants.js";
import { documentFromHtml } from "./html.js";

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Parsed `#__NEXT_DATA__`, or null. */
export function readNextData(html) {
  const document = documentFromHtml(html);
  const script = document.querySelector(NEXT_DATA_SCRIPT);
  const parsed = parseJson(script?.textContent || "");
  return parsed && typeof parsed === "object" ? parsed : null;
}

export function readPageProps(html) {
  const props = readNextData(html)?.props?.pageProps;
  return props && typeof props === "object" ? props : null;
}

export function readSsrHits(html) {
  const hits = readPageProps(html)?.ssrHits;
  return Array.isArray(hits) ? hits.filter((hit) => hit && typeof hit === "object") : [];
}

export function readDetailJob(html) {
  const job = readPageProps(html)?.job;
  return job && typeof job === "object" ? job : null;
}

export function hasNextDataJob(html) {
  return Boolean(readDetailJob(html));
}

export function readJobPostingJsonLd(html) {
  return parseJobPostingJsonLd(html);
}

/**
 * HiringCafe sets `ssrSignedIn` on classic/detail pageProps. `true` / `false`
 * are explicit; missing is unknown (list pages treat that as signed out).
 */
export function readSignedIn(html) {
  const value = readPageProps(html)?.ssrSignedIn;
  if (value === true) return true;
  if (value === false) return false;
  return undefined;
}
