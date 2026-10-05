/* global chrome */
import {
  SCRAPE_QUEUE_ALARM,
  SCRAPE_QUEUE_BATCH_SIZE,
  SCRAPE_QUEUE_MAX_ATTEMPTS,
  SCRAPE_QUEUE_STORAGE_KEY,
  classifyBulkItem,
  emptyRunSummary,
  incrementRunOutcome,
  isRetryableBulkItem,
  normalizeQueueState,
  queueCounts,
  retryDelayMs,
  selectReadyItems,
} from "../api/scrapeQueue.js";
import {
  API_URL,
  CRAWLER_INGEST_PATH,
  CRAWLER_INGEST_TOKEN,
  JOB_API_STORAGE_KEY,
  SCRAPE_SOURCE,
} from "../config/env.js";

import { normalizeBaseUrl, safeSendMessage, storageGet, storageSet } from "./runtime.js";

let scrapeQueueState = normalizeQueueState();
let scrapeQueueReady = false;
let scrapeQueueDrainPromise = null;
let scrapeQueueInitialization = null;

function trimRunSummaries() {
  const entries = Object.entries(scrapeQueueState.runs);
  if (entries.length <= 20) return;
  entries.sort(([, a], [, b]) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  scrapeQueueState.runs = Object.fromEntries(entries.slice(0, 20));
}

// Writes are chained (not awaited by callers that don't need to) so the
// scrape loop's enqueue ack never waits on a full-queue storage write, while
// still guaranteeing writes hit storage in order with the latest state.
let persistScrapeQueueTail = Promise.resolve();

function persistScrapeQueue() {
  trimRunSummaries();
  persistScrapeQueueTail = persistScrapeQueueTail
    .then(() => storageSet({ [SCRAPE_QUEUE_STORAGE_KEY]: scrapeQueueState }))
    .catch((error) => console.error("Failed to persist scrape queue", error));
  return persistScrapeQueueTail;
}

function scrapeQueueSnapshot(runId = null) {
  const resolvedRunId =
    runId ||
    Object.entries(scrapeQueueState.runs).sort(
      ([, a], [, b]) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0),
    )[0]?.[0] ||
    null;
  return {
    runId: resolvedRunId,
    counts: queueCounts(scrapeQueueState.items, resolvedRunId),
    summary: resolvedRunId
      ? { ...emptyRunSummary(), ...(scrapeQueueState.runs[resolvedRunId] || {}) }
      : null,
  };
}

function broadcastScrapeQueue(runId = null) {
  safeSendMessage({ action: "scrapeQueue:state", payload: scrapeQueueSnapshot(runId) });
}

function recordScrapeQueueOutcome(runId, outcome) {
  scrapeQueueState.runs = incrementRunOutcome(scrapeQueueState.runs, runId, outcome);
  scrapeQueueState.runs[runId].updatedAt = Date.now();
}

function scheduleScrapeQueueRetry() {
  const nextAttemptAt = scrapeQueueState.items
    .filter((item) => item.status === "queued" && item.nextAttemptAt > Date.now())
    .reduce((earliest, item) => Math.min(earliest, item.nextAttemptAt), Infinity);
  if (Number.isFinite(nextAttemptAt)) {
    chrome.alarms.create(SCRAPE_QUEUE_ALARM, { when: nextAttemptAt });
  } else {
    chrome.alarms.clear(SCRAPE_QUEUE_ALARM);
  }
}

function scheduleImmediateScrapeQueueDrain() {
  chrome.alarms.create(SCRAPE_QUEUE_ALARM, { when: Date.now() + 100 });
}

async function resolveJobApiUrl() {
  return normalizeBaseUrl(API_URL || (await storageGet(JOB_API_STORAGE_KEY)));
}

async function requeueScrapeBatch(batch, error, retryable = true) {
  const now = Date.now();
  for (const selected of batch) {
    const item = scrapeQueueState.items.find((candidate) => candidate.id === selected.id);
    if (!item) continue;
    item.attempts += 1;
    if (retryable && item.attempts < SCRAPE_QUEUE_MAX_ATTEMPTS) {
      item.status = "queued";
      item.nextAttemptAt = now + retryDelayMs(item.attempts);
      item.lastError = error;
    } else {
      scrapeQueueState.items = scrapeQueueState.items.filter(
        (candidate) => candidate.id !== item.id,
      );
      recordScrapeQueueOutcome(item.runId, "failed");
      safeSendMessage({
        action: "scrapeQueue:itemResult",
        payload: { id: item.id, runId: item.runId, outcome: "failed", error },
      });
    }
  }
}

async function processScrapeBatch(batch) {
  const baseUrl = await resolveJobApiUrl();
  if (!baseUrl) {
    await requeueScrapeBatch(batch, "API base URL is not configured");
    return;
  }

  if (!CRAWLER_INGEST_TOKEN) {
    await requeueScrapeBatch(batch, "VITE_CRAWLER_INGEST_TOKEN is not configured");
    return;
  }

  const ingestUrl = `${baseUrl}${CRAWLER_INGEST_PATH}`;
  console.log("[scrapeQueue] POST", ingestUrl, `(${batch.length} jobs)`);
  let response;
  try {
    response = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CRAWLER_INGEST_TOKEN}`,
      },
      body: JSON.stringify({
        createdBy: SCRAPE_SOURCE,
        jobs: batch.map((item) => item.job),
      }),
    });
  } catch (error) {
    console.warn("[scrapeQueue] fetch failed", error);
    await requeueScrapeBatch(batch, error instanceof Error ? error.message : String(error));
    return;
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    /* handled below */
  }
  console.log("[scrapeQueue] response", response.status, body?.summary || body?.error || body);
  if (!response.ok || !Array.isArray(body?.results)) {
    await requeueScrapeBatch(
      batch,
      body?.error || `Bulk registration failed (${response.status})`,
      response.status >= 500,
    );
    return;
  }

  for (const [index, selected] of batch.entries()) {
    const item = scrapeQueueState.items.find((candidate) => candidate.id === selected.id);
    if (!item) continue;
    const result =
      body.results.find((candidate) => candidate.index === index) || body.results[index];
    if (isRetryableBulkItem(result) && item.attempts + 1 < SCRAPE_QUEUE_MAX_ATTEMPTS) {
      item.attempts += 1;
      item.status = "queued";
      item.nextAttemptAt = Date.now() + retryDelayMs(item.attempts);
      item.lastError = result?.error || "Server failed to register job";
      continue;
    }

    const outcome = classifyBulkItem(result);
    scrapeQueueState.items = scrapeQueueState.items.filter((candidate) => candidate.id !== item.id);
    recordScrapeQueueOutcome(item.runId, outcome);
    safeSendMessage({
      action: "scrapeQueue:itemResult",
      payload: { id: item.id, runId: item.runId, outcome, result },
    });
  }
}

export async function drainScrapeQueue() {
  if (!scrapeQueueReady) return;
  if (scrapeQueueDrainPromise) return scrapeQueueDrainPromise;
  scrapeQueueDrainPromise = (async () => {
    while (true) {
      const now = Date.now();
      const batch = selectReadyItems(scrapeQueueState.items, now, SCRAPE_QUEUE_BATCH_SIZE);
      if (!batch.length) break;
      for (const item of batch) item.status = "saving";
      await persistScrapeQueue();
      for (const runId of new Set(batch.map((item) => item.runId))) broadcastScrapeQueue(runId);
      await processScrapeBatch(batch);
      await persistScrapeQueue();
      for (const runId of new Set(batch.map((item) => item.runId))) broadcastScrapeQueue(runId);
    }
    scheduleScrapeQueueRetry();
  })().finally(() => {
    scrapeQueueDrainPromise = null;
  });
  return scrapeQueueDrainPromise;
}

async function initializeScrapeQueue() {
  scrapeQueueState = normalizeQueueState(await storageGet(SCRAPE_QUEUE_STORAGE_KEY));
  scrapeQueueReady = true;
  await persistScrapeQueue();
  broadcastScrapeQueue();
  scheduleImmediateScrapeQueueDrain();
  void drainScrapeQueue();
}

/** Loads the persisted queue and starts draining it. Message handlers wait for this. */
export function startScrapeQueue() {
  scrapeQueueInitialization = initializeScrapeQueue().catch((error) => {
    console.error("Failed to initialize scrape registration queue", error);
  });
}

export function handleScrapeQueueEnqueue(message, sendResponse) {
  (async () => {
    await scrapeQueueInitialization;
    const runId = typeof message.payload?.runId === "string" ? message.payload.runId : "";
    const job = message.payload?.job;
    if (!runId || !job || typeof job !== "object") {
      sendResponse?.({ success: false, error: "runId and job are required" });
      return;
    }
    const id =
      globalThis.crypto?.randomUUID?.() ||
      `scrape-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    scrapeQueueState.items.push({
      id,
      runId,
      job,
      status: "queued",
      attempts: 0,
      createdAt: Date.now(),
      nextAttemptAt: 0,
    });
    if (!scrapeQueueState.runs[runId]) {
      scrapeQueueState.runs[runId] = { ...emptyRunSummary(), updatedAt: Date.now() };
    }
    broadcastScrapeQueue(runId);
    // Ack immediately so the scrape loop is not blocked on the storage
    // write or the backend send. Alarm + fire-and-forget drain/persist
    // keep MV3 saving/sending in the background.
    sendResponse?.({ success: true, id, state: scrapeQueueSnapshot(runId) });
    scheduleImmediateScrapeQueueDrain();
    void persistScrapeQueue();
    void drainScrapeQueue();
  })().catch((error) => sendResponse?.({ success: false, error: error.message }));
}

export function handleScrapeQueueClear(message, sendResponse) {
  (async () => {
    await scrapeQueueInitialization;
    const runId = typeof message.payload?.runId === "string" ? message.payload.runId : null;
    if (runId) {
      scrapeQueueState.items = scrapeQueueState.items.filter((item) => item.runId !== runId);
      delete scrapeQueueState.runs[runId];
    } else {
      scrapeQueueState = normalizeQueueState();
    }
    await persistScrapeQueue();
    broadcastScrapeQueue(runId);
    sendResponse?.({ success: true, state: scrapeQueueSnapshot(runId) });
  })().catch((error) => sendResponse?.({ success: false, error: error.message }));
}

export function handleScrapeQueueGetState(message, sendResponse) {
  (async () => {
    await scrapeQueueInitialization;
    const runId = typeof message.payload?.runId === "string" ? message.payload.runId : null;
    sendResponse?.({ success: true, state: scrapeQueueSnapshot(runId) });
  })().catch((error) => sendResponse?.({ success: false, error: error.message }));
}

export function handleScrapeQueueRecordOutcome(message, sendResponse) {
  (async () => {
    await scrapeQueueInitialization;
    const { runId, outcome } = message.payload || {};
    if (!runId) throw new Error("runId is required");
    recordScrapeQueueOutcome(runId, outcome);
    await persistScrapeQueue();
    broadcastScrapeQueue(runId);
    sendResponse?.({ success: true });
  })().catch((error) => sendResponse?.({ success: false, error: error.message }));
}
