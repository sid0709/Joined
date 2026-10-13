import { LIST_CHANGE_MS, LIST_CHANGE_POLL_MS, NEXT_PAGE, NEXT_PAGE_LABEL } from "./constants.js";
import { cardIdKey, exactJobsListUrl, pageFromListUrl } from "./lists.js";
import { parseList } from "./parseList.js";

export function firstCardId(cards) {
  return String(cards?.[0]?.id || "");
}

/** Persist the list URL Built In actually landed on. Never rebuild query params. */
export function rememberObservedListUrl(cursor, url) {
  const exact = exactJobsListUrl(url);
  if (!exact) return cursor;
  const lists = cursor.lists ?? [];
  const index = Number.isInteger(cursor.listIndex) ? cursor.listIndex : 0;
  if (lists[index] === exact) return cursor;
  const next = [...lists];
  next[index] = exact;
  return { ...cursor, lists: next };
}

/** Restore a landed ?page= URL. Empty means click Next forward from startUrl. */
export function restoreListUrl(cursor) {
  const stored = cursor?.lists?.[cursor.listIndex] || "";
  const startUrl = cursor?.startUrl || stored;
  const page = Number.isInteger(cursor?.page) && cursor.page > 1 ? cursor.page : 1;
  if (stored && pageFromListUrl(stored) === page) return stored;
  if (stored && stored !== startUrl) return stored;
  return page <= 1 ? stored || startUrl : "";
}

export function clickForwardCount(cursor) {
  const page = Number.isInteger(cursor?.page) && cursor.page > 1 ? cursor.page : 1;
  return page - 1;
}

export function listResultsChanged(previous, current) {
  if (current.pageIds && current.pageIds !== previous.pageIds) return true;
  if (previous.url && current.url && current.url !== previous.url) return true;
  return false;
}

export async function waitForListChange({
  readPage,
  rest,
  skipDelays,
  checkStopped,
  previousPageIds,
  previousUrl,
  parse = parseList,
  now = Date.now,
  timeoutMs = LIST_CHANGE_MS,
}) {
  const readParsed = async () => {
    const page = await readPage();
    const parsed = parse(page.html, page.url);
    const pageIds = cardIdKey(parsed.cards);
    return { page, parsed, pageIds, firstId: firstCardId(parsed.cards) };
  };
  const previous = { pageIds: previousPageIds, url: previousUrl };
  const withChange = (snapshot) => ({
    ...snapshot,
    changed: listResultsChanged(previous, { pageIds: snapshot.pageIds, url: snapshot.page.url }),
  });
  if (skipDelays) return withChange(await readParsed());
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    checkStopped();
    await rest(LIST_CHANGE_POLL_MS);
    const snapshot = withChange(await readParsed());
    if (snapshot.changed) return snapshot;
  }
  return withChange(await readParsed());
}

async function clickAndWait(call, waitArgs) {
  const clicked = await call("click", { selector: NEXT_PAGE });
  if (!clicked?.found) return { advanced: false, found: false };
  const snapshot = await waitForListChange(waitArgs);
  if (!snapshot.changed) return { advanced: false, found: true, stuck: true, ...snapshot };
  return { advanced: true, found: true, ...snapshot };
}

/** Click Built In's Next control and wait until the card set or URL changes. */
export async function clickNextPage({
  call,
  readPage,
  rest,
  skipDelays,
  checkStopped,
  previousPageIds,
  previousUrl,
  onActivity,
  parse,
  now,
  timeoutMs,
}) {
  onActivity?.({ phase: "open", label: NEXT_PAGE_LABEL, kind: "click" });
  const waitArgs = {
    readPage,
    rest,
    skipDelays,
    checkStopped,
    previousPageIds,
    previousUrl,
    parse,
    now,
    timeoutMs,
  };
  const first = await clickAndWait(call, waitArgs);
  if (first.advanced || !first.found) return first;
  onActivity?.({ phase: "open", label: NEXT_PAGE_LABEL, kind: "click" });
  const retried = await clickAndWait(call, waitArgs);
  if (retried.advanced) return retried;
  return { ...retried, found: first.found || retried.found, stuck: true };
}

export async function openListForCursor({
  cursor,
  openVisible,
  clickNext,
  alreadyOpen,
  label,
  phase = "open",
  parse = parseList,
}) {
  if (alreadyOpen) return alreadyOpen;
  const direct = restoreListUrl(cursor);
  if (direct) return openVisible(direct, label, phase);
  const start = cursor.startUrl || cursor.lists?.[0];
  let page = await openVisible(start, label, phase);
  const hops = clickForwardCount(cursor);
  for (let index = 0; index < hops; index += 1) {
    const parsed = parse(page.html, page.url);
    const moved = await clickNext({
      previousPageIds: cardIdKey(parsed.cards),
      previousUrl: page.url,
    });
    if (!moved?.advanced) return page;
    page = moved.page;
  }
  return page;
}
