import { LIST_CHANGE_MS, LIST_CHANGE_POLL_MS, NEXT_PAGE, NEXT_PAGE_LABEL } from "./constants.js";
import { exactJobsListUrl } from "./lists.js";
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

export async function waitForFirstCardChange({
  readPage,
  rest,
  skipDelays,
  checkStopped,
  previousFirstId,
  parse = parseList,
  now = Date.now,
  timeoutMs = LIST_CHANGE_MS,
}) {
  const readParsed = async () => {
    const page = await readPage();
    const parsed = parse(page.html, page.url);
    return { page, parsed, firstId: firstCardId(parsed.cards) };
  };
  if (skipDelays) {
    const snapshot = await readParsed();
    return { ...snapshot, changed: snapshot.firstId !== previousFirstId };
  }
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    checkStopped();
    await rest(LIST_CHANGE_POLL_MS);
    const snapshot = await readParsed();
    if (snapshot.firstId !== previousFirstId) return { ...snapshot, changed: true };
  }
  const snapshot = await readParsed();
  return { ...snapshot, changed: snapshot.firstId !== previousFirstId };
}

/** Click Built In's Next control and wait until the first job id changes. */
export async function clickNextPage({
  call,
  readPage,
  rest,
  skipDelays,
  checkStopped,
  previousFirstId,
  onActivity,
  parse,
  now,
  timeoutMs,
}) {
  onActivity?.({ phase: "open", label: NEXT_PAGE_LABEL, kind: "click" });
  const clicked = await call("click", { selector: NEXT_PAGE });
  if (!clicked?.found) return { advanced: false };
  const snapshot = await waitForFirstCardChange({
    readPage,
    rest,
    skipDelays,
    checkStopped,
    previousFirstId,
    parse,
    now,
    timeoutMs,
  });
  if (!snapshot.changed) return { advanced: false, ...snapshot };
  return { advanced: true, ...snapshot };
}
