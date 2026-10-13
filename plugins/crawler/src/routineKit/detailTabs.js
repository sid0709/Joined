/** Jobs whose pages open at once in background tabs; each tab closes once read. */
export const DETAIL_TAB_BATCH = 30;
/** How long one background job tab may take to become ready. */
export const DETAIL_TAB_TIMEOUT_MS = 20_000;
/** Headroom on the openDetailTabs op beyond its tabs' own timeouts. */
export const DETAIL_TABS_OP_SLACK_MS = 10_000;
export const DETAIL_TABS_LABEL = "Opening job tabs";

/**
 * Open every job's page at once in background tabs beside the crawl tab (the
 * background closes each tab once read) and return the ready pages by job id.
 * `isReady(html)` is the board's own check; a job missing from the map
 * (challenge, timeout, not ready) is opened in the crawl tab by the caller.
 */
export async function fetchDetailPages({
  call,
  jobs,
  readySelectors,
  challengeTitle = "",
  challengeSelector = "",
  isReady,
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
  const waves = Math.ceil(withUrl.length / DETAIL_TAB_BATCH);
  const result = await call(
    "openDetailTabs",
    {
      urls: withUrl.map((job) => job.url),
      concurrency: DETAIL_TAB_BATCH,
      timeoutMs: DETAIL_TAB_TIMEOUT_MS,
      readySelectors,
      challengeTitle,
      challengeSelector,
    },
    waves * DETAIL_TAB_TIMEOUT_MS + DETAIL_TABS_OP_SLACK_MS,
  ).catch(() => null);
  (result?.pages ?? []).forEach((page, index) => {
    const job = withUrl[index];
    if (!job || !page?.html || !isReady(page.html)) return;
    pages.set(job.id, { html: page.html, url: page.finalUrl || page.url || job.url, status: 200 });
  });
  return pages;
}
