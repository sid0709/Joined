import { BUILTIN_ORIGIN, JOBS_PATH, PAGE_PARAM } from "./constants.js";
import { isBuiltinUrl, originOf } from "./html.js";

function unique(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

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

/**
 * Lists to crawl: the current jobs URL (if any), `/jobs`, and each category
 * from `Builtin.jobBoardInit`. Industry / company-size URL forms are unverified
 * and are left out on purpose. The visible crawl uses `crawlListUrl` only.
 */
export function listUrlsFromBoard(board, currentUrl) {
  const origin = originOf(currentUrl) || BUILTIN_ORIGIN;
  const urls = [];
  const add = (href) => {
    try {
      urls.push(stripPageParam(new URL(href, origin).href));
    } catch {
      // Ignore a malformed option from the board payload.
    }
  };
  add(JOBS_PATH);
  if (isJobsListUrl(currentUrl)) add(currentUrl);
  for (const category of board?.categoriesFilterOptions ?? []) {
    const alias = category.urlName || category.alias;
    if (alias) add(`${JOBS_PATH}/${alias}`);
  }
  return unique(urls);
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
