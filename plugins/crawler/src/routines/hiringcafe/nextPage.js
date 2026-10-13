import { NAVIGATE_WAIT_MS, NEXT_PAGE, NEXT_PAGE_LABEL, NEXT_PAGE_POLL_MS } from "./constants.js";
import { isClassicListUrl, pageFromListUrl } from "./lists.js";

function landedOn(page, pageIndex) {
  return Boolean(
    page?.html && isClassicListUrl(page.url) && pageFromListUrl(page.url) === pageIndex,
  );
}

/**
 * Click HiringCafe's Next page link and wait for `?page=<pageIndex>` to load.
 * Returns the landed page, or null so the caller opens the URL itself.
 */
export async function clickNextPage({
  call,
  readPage,
  rest,
  skipDelays,
  checkStopped,
  pageIndex,
  onActivity,
  now = Date.now,
}) {
  onActivity?.({ phase: "open", label: NEXT_PAGE_LABEL, kind: "click" });
  // The link unloads the page, so a lost op response still means it was clicked.
  const clicked = await call("click", { selector: NEXT_PAGE }).catch(() => ({ found: true }));
  if (!clicked?.found) return null;
  const read = () => readPage().catch(() => null);
  if (skipDelays) {
    const page = await read();
    return landedOn(page, pageIndex) ? page : null;
  }
  const deadline = now() + NAVIGATE_WAIT_MS;
  while (now() < deadline) {
    checkStopped?.();
    await rest(NEXT_PAGE_POLL_MS);
    const page = await read();
    if (landedOn(page, pageIndex)) return page;
  }
  return null;
}
