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

/** The jobs list URL exactly as the tab has it. Never strip or rebuild params. */
export function exactJobsListUrl(url) {
  return isJobsListUrl(url) ? url : "";
}

export function emptyCursor(lists = [], startUrl = "") {
  return {
    listIndex: 0,
    page: 1,
    lastJobId: "",
    lastPageIds: "",
    pageProcessed: 0,
    lists,
    startUrl: startUrl || lists[0] || "",
  };
}

/** Resume a stored list URL, or start on the tab's current filtered jobs URL. */
export function cursorForTab(currentUrl, existing) {
  if (existing?.lists?.length) return existing;
  const exact = exactJobsListUrl(currentUrl);
  const startUrl = existing?.startUrl || exact;
  const listUrl = exact || startUrl || `${originOf(currentUrl) || BUILTIN_ORIGIN}${JOBS_PATH}`;
  return emptyCursor([listUrl], startUrl || listUrl);
}

export function cardIdKey(cards) {
  return [...new Set((cards ?? []).map((card) => String(card.id)).filter(Boolean))]
    .sort()
    .join("\n");
}

export function advanceCursor(cursor, { nextPage, nextList } = {}) {
  if (nextPage) {
    return { ...cursor, page: cursor.page + 1, lastJobId: "", pageProcessed: 0 };
  }
  if (nextList) {
    return {
      ...cursor,
      listIndex: cursor.listIndex + 1,
      page: 1,
      lastJobId: "",
      lastPageIds: "",
      pageProcessed: 0,
    };
  }
  return cursor;
}

/** Advance only after a card was enqueued or verified saved, or the page is already handled. */
export function canAdvanceBuiltinPage({ cardCount = 0, pageProcessed = 0, allHandled = false }) {
  if (cardCount === 0) return false;
  return pageProcessed > 0 || allHandled === true;
}
