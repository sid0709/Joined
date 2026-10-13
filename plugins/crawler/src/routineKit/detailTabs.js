/** Jobs whose pages open at once in background tabs. */
export const DETAIL_TAB_BATCH = 30;
/** How often the run reads the open job tabs. */
export const DETAIL_TAB_POLL_MS = 1_000;
/** A job tab still not ready after this long is reloaded once. */
export const DETAIL_TAB_RELOAD_AFTER_MS = 30_000;
/** A job tab still not ready after this long is closed; the crawl tab opens that job. */
export const DETAIL_TAB_TIMEOUT_MS = 60_000;
export const DETAIL_TABS_LABEL = "Opening job tabs";
export const DETAIL_TABS_WAIT_LABEL = "Waiting for job tabs to load";

const RELOAD_AFTER_POLLS = DETAIL_TAB_RELOAD_AFTER_MS / DETAIL_TAB_POLL_MS;
const TIMEOUT_POLLS = DETAIL_TAB_TIMEOUT_MS / DETAIL_TAB_POLL_MS;

function closeTabs(call, tabIds) {
  if (!tabIds.length) return Promise.resolve();
  return call("closeDetailTabs", { tabIds }).catch(() => {});
}

/**
 * Open every job's page in a background tab and keep each tab open until the
 * board's own `isReady(html)` passes on it, so a blank or half-loaded page is
 * never taken as read. A tab is closed once read, on a challenge
 * (`isChallenge(page)`), or after DETAIL_TAB_TIMEOUT_MS (one reload on the
 * way). Returns ready pages by job id; a missing job opens in the crawl tab.
 */
export async function fetchDetailPages({
  call,
  rest,
  skipDelays = false,
  checkStopped,
  jobs,
  isReady,
  isChallenge = () => false,
  onActivity,
}) {
  const pages = new Map();
  const withUrl = (jobs ?? []).filter((job) => job?.url);
  if (!withUrl.length) return pages;
  onActivity?.({
    phase: "open",
    label: `${DETAIL_TABS_LABEL} (${withUrl.length})`,
    kind: "click",
  });
  const opened = await call("openDetailTabs", { urls: withUrl.map((job) => job.url) }).catch(
    () => null,
  );
  const pending = new Map();
  (opened?.tabs ?? []).forEach((tab, index) => {
    if (tab?.tabId != null && withUrl[index]) pending.set(tab.tabId, withUrl[index]);
  });
  try {
    for (let poll = 1; pending.size && poll <= TIMEOUT_POLLS; poll += 1) {
      checkStopped?.();
      if (!skipDelays) await rest(DETAIL_TAB_POLL_MS);
      const read = await call("readDetailTabs", { tabIds: [...pending.keys()] }).catch(() => null);
      const done = [];
      for (const page of read?.pages ?? []) {
        const job = pending.get(page.tabId);
        if (!job) continue;
        if (page.html && isReady(page.html)) {
          pages.set(job.id, { html: page.html, url: page.url || job.url, status: 200 });
          done.push(page.tabId);
        } else if (page.html && isChallenge(page)) {
          done.push(page.tabId);
        }
      }
      for (const tabId of done) pending.delete(tabId);
      await closeTabs(call, done);
      if (pending.size) {
        onActivity?.({
          phase: "ready",
          label: `${DETAIL_TABS_WAIT_LABEL} (${pending.size})`,
          kind: "waitFor",
        });
      }
      if (poll === RELOAD_AFTER_POLLS && pending.size) {
        await call("reloadDetailTabs", { tabIds: [...pending.keys()] }).catch(() => {});
      }
    }
  } finally {
    // Timed out, stopped, or failed: never leave a job tab open.
    await closeTabs(call, [...pending.keys()]);
  }
  return pages;
}
