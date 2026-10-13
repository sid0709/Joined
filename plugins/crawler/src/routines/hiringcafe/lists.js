import {
  CLASSIC_PATH,
  FIRST_PAGE_INDEX,
  HIRINGCAFE_ORIGIN,
  JOB_PATH,
  PAGE_PARAM,
  SEARCH_STATE_PARAM,
} from "./constants.js";
import { isHiringCafeUrl, originOf } from "./html.js";

export function stripPageParam(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete(PAGE_PARAM);
    return parsed.href;
  } catch {
    return url;
  }
}

export function isClassicListUrl(url) {
  try {
    const parsed = new URL(url);
    return isHiringCafeUrl(parsed.href) && parsed.pathname.replace(/\/$/, "") === CLASSIC_PATH;
  } catch {
    return false;
  }
}

/** Path plus sorted query without `?page=`: the filters (`searchState`, ...) a list shows. */
export function listFilterKey(url) {
  try {
    const parsed = new URL(stripPageParam(url));
    parsed.searchParams.sort();
    return `${parsed.pathname.replace(/\/$/, "")}?${parsed.searchParams.toString()}`;
  } catch {
    return "";
  }
}

export function sameListFilters(left, right) {
  const key = listFilterKey(left);
  return Boolean(key) && key === listFilterKey(right);
}

export function isJobDetailUrl(url) {
  try {
    const parsed = new URL(url);
    return isHiringCafeUrl(parsed.href) && parsed.pathname.startsWith(JOB_PATH);
  } catch {
    return false;
  }
}

export function listUrlForPage(listUrl, page) {
  const parsed = new URL(stripPageParam(listUrl));
  if (!Number.isInteger(page) || page <= FIRST_PAGE_INDEX) {
    parsed.searchParams.delete(PAGE_PARAM);
    return parsed.href;
  }
  parsed.searchParams.set(PAGE_PARAM, String(page));
  return parsed.href;
}

export function pageFromListUrl(url) {
  try {
    const page = Number(new URL(url).searchParams.get(PAGE_PARAM));
    return Number.isInteger(page) && page >= FIRST_PAGE_INDEX ? page : FIRST_PAGE_INDEX;
  } catch {
    return FIRST_PAGE_INDEX;
  }
}

/** The classic list this tab is on, stripped of `?page=`. Falls back to `/classic`. */
export function crawlListUrl(currentUrl) {
  if (isClassicListUrl(currentUrl)) return stripPageParam(currentUrl);
  try {
    const parsed = new URL(currentUrl);
    const origin = originOf(currentUrl) || HIRINGCAFE_ORIGIN;
    const next = new URL(CLASSIC_PATH, origin);
    const searchState = parsed.searchParams.get(SEARCH_STATE_PARAM);
    if (searchState) next.searchParams.set(SEARCH_STATE_PARAM, searchState);
    return next.href;
  } catch {
    return `${HIRINGCAFE_ORIGIN}${CLASSIC_PATH}`;
  }
}

export function emptyCursor(lists = []) {
  return { listIndex: 0, page: FIRST_PAGE_INDEX, lastJobId: "", lastPageIds: "", lists };
}

export function jobIdKey(jobs) {
  return [...new Set((jobs ?? []).map((job) => String(job.id)).filter(Boolean))].sort().join("\n");
}

export function advanceCursor(cursor, { nextPage } = {}) {
  if (nextPage) {
    return { ...cursor, page: cursor.page + 1, lastJobId: "" };
  }
  return cursor;
}

export function jobUrlFromHit(hit, pageUrl) {
  const path = hit?.path || hit?.url;
  if (!path) return "";
  try {
    return new URL(path, pageUrl || HIRINGCAFE_ORIGIN).href;
  } catch {
    return "";
  }
}
