import { BUILTIN_ORIGIN, JOBS_PATH, PAGE_PARAM } from "./constants.js";
import { isBuiltinUrl, originOf } from "./html.js";

export function stripPageParam(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete(PAGE_PARAM);
    return parsed.href;
  } catch {
    return url;
  }
}

export function isJobsListUrl(url) {
  try {
    const parsed = new URL(url);
    return isBuiltinUrl(parsed.href) && parsed.pathname.startsWith(JOBS_PATH);
  } catch {
    return false;
  }
}

export function listUrlForPage(listUrl, page) {
  const parsed = new URL(stripPageParam(listUrl));
  if (!page || page <= 1) {
    parsed.searchParams.delete(PAGE_PARAM);
    return parsed.href;
  }
  parsed.searchParams.set(PAGE_PARAM, String(page));
  return parsed.href;
}

export function pageFromListUrl(url) {
  try {
    const page = Number(new URL(url).searchParams.get(PAGE_PARAM));
    return Number.isInteger(page) && page > 1 ? page : 1;
  } catch {
    return 1;
  }
}

/** The jobs list this tab is on, stripped of `?page=`. Falls back to `/jobs`. */
export function crawlListUrl(currentUrl) {
  if (isJobsListUrl(currentUrl)) return stripPageParam(currentUrl);
  return `${originOf(currentUrl) || BUILTIN_ORIGIN}${JOBS_PATH}`;
}

export function emptyCursor(lists = []) {
  return { listIndex: 0, page: 1, lastJobId: "", lastPageIds: "", lists };
}

export function cardIdKey(cards) {
  return [...new Set((cards ?? []).map((card) => String(card.id)).filter(Boolean))]
    .sort()
    .join("\n");
}

export function advanceCursor(cursor, { nextPage, nextList } = {}) {
  if (nextPage) {
    return { ...cursor, page: cursor.page + 1, lastJobId: "" };
  }
  if (nextList) {
    return { ...cursor, listIndex: cursor.listIndex + 1, page: 1, lastJobId: "", lastPageIds: "" };
  }
  return cursor;
}
