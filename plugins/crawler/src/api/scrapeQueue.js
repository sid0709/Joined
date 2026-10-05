export const SCRAPE_QUEUE_STORAGE_KEY = "scrapeRegistrationQueueV1";
export const SCRAPE_QUEUE_ALARM = "scrapeRegistrationQueue:retry";
export const SCRAPE_QUEUE_BATCH_SIZE = 5;
export const SCRAPE_QUEUE_MAX_ATTEMPTS = 5;

const OUTCOMES = ["registered", "duplicate", "validation", "blocked", "failed"];

export function emptyRunSummary() {
  return Object.fromEntries(OUTCOMES.map((outcome) => [outcome, 0]));
}

export function normalizeQueueState(raw) {
  const state = raw && typeof raw === "object" ? raw : {};
  const items = Array.isArray(state.items) ? state.items : [];
  const runs = state.runs && typeof state.runs === "object" ? state.runs : {};
  return {
    items: items
      .filter((item) => item?.id && item?.runId && item?.job)
      .map((item) => ({
        ...item,
        // An interrupted request is safe to retry because the server owns
        // the atomic identity claim and will return a duplicate if it committed.
        status: "queued",
        attempts: Number.isFinite(item.attempts) ? item.attempts : 0,
        nextAttemptAt: Number.isFinite(item.nextAttemptAt) ? item.nextAttemptAt : 0,
      })),
    runs: Object.fromEntries(
      Object.entries(runs).map(([runId, summary]) => [
        runId,
        { ...emptyRunSummary(), ...(summary || {}) },
      ]),
    ),
  };
}

export function queueCounts(items, runId = null) {
  const selected = runId ? items.filter((item) => item.runId === runId) : items;
  return {
    queued: selected.filter((item) => item.status === "queued").length,
    saving: selected.filter((item) => item.status === "saving").length,
  };
}

export function selectReadyItems(items, now, limit = SCRAPE_QUEUE_BATCH_SIZE) {
  return items
    .filter((item) => item.status === "queued" && item.nextAttemptAt <= now)
    .slice(0, limit);
}

export function classifyBulkItem(result) {
  if (result?.created === true && result?.success !== false) return "registered";
  if (result?.duplicate === true) return "duplicate";
  if (
    String(result?.reason || "")
      .toLowerCase()
      .includes("blocked by rule")
  )
    return "blocked";
  return "failed";
}

export function retryDelayMs(attempts) {
  const delays = [5_000, 15_000, 60_000, 300_000];
  return delays[Math.min(Math.max(0, attempts - 1), delays.length - 1)];
}

export function isRetryableBulkItem(result) {
  const status = Number(result?.statusCode || 0);
  return status >= 500 || status === 0;
}

export function incrementRunOutcome(runs, runId, outcome) {
  if (!OUTCOMES.includes(outcome)) return runs;
  const current = { ...emptyRunSummary(), ...(runs[runId] || {}) };
  return { ...runs, [runId]: { ...current, [outcome]: current[outcome] + 1 } };
}
