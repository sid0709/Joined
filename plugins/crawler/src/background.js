/* global chrome */
import {
  API_URL,
  JOB_API_STORAGE_KEY,
  persistJobApiUrlToStorage,
  persistSpiritApiUrlToStorage,
  SCRAPE_SOURCE,
} from "./config/env.js";
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
} from "./api/scrapeQueue.js";

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Actions that need to be sent to the content script
const actionsToForward = [
  "highlightByPattern",
  "highlightBySelectors",
  "highlightInteractables",
  "executePlan",
  "collectDomHints",
  "clearHighlight",
  "executeAction",
  "executeActionsSequence",
  "executeActionsParallel",
];

const JOB_BID_STORAGE_KEY = "jobBidStore";
const MAX_RECENT_JOB_EVENTS = 5;
const MAX_TRACKED_JOBS = 500;
const pendingStoreTasks = [];
let storeReady = false;
let scrapeQueueState = normalizeQueueState();
let scrapeQueueReady = false;
let scrapeQueueDrainPromise = null;

function isInjectableTabUrl(url) {
  if (!url || typeof url !== "string") return false;
  return /^(https?:|file:)/i.test(url);
}

/**
 * Side panel clicks often leave currentWindow ambiguous (or focused on DevTools).
 * Prefer an explicit tabId, then last-focused window, then any normal window's active tab.
 */
async function resolveTargetTab(message) {
  const explicitTabId = message?.tabId ?? message?.payload?.tabId;
  if (Number.isFinite(explicitTabId)) {
    try {
      const tab = await chrome.tabs.get(explicitTabId);
      if (tab?.id && isInjectableTabUrl(tab.url)) return tab;
    } catch (e) {
      console.warn("Failed to resolve explicit tabId", explicitTabId, e);
    }
  }

  const queryFirstInjectable = async (queryInfo) => {
    try {
      const tabs = await chrome.tabs.query(queryInfo);
      return tabs.find((tab) => tab?.id && isInjectableTabUrl(tab.url)) || null;
    } catch (e) {
      console.warn("tabs.query failed", queryInfo, e);
      return null;
    }
  };

  const fromLastFocused = await queryFirstInjectable({ active: true, lastFocusedWindow: true });
  if (fromLastFocused) return fromLastFocused;

  const fromCurrent = await queryFirstInjectable({ active: true, currentWindow: true });
  if (fromCurrent) return fromCurrent;

  try {
    const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
    const ordered = [
      ...windows.filter((win) => win.focused),
      ...windows.filter((win) => !win.focused),
    ];
    for (const win of ordered) {
      const active = win.tabs?.find((tab) => tab.active && isInjectableTabUrl(tab.url));
      if (active) return active;
    }
  } catch (e) {
    console.warn("windows.getAll fallback failed", e);
  }

  return null;
}

async function ensureContentScriptInjected(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      func: () => {
        const ATTR = "data-autolancer-content-script-injected";
        const root = document.documentElement || document.head || document.body;
        if (!root) return false;
        // Only *check* if injected. Do not set any flags here because the content script
        // uses the same guards and would skip initialization if we pre-set them.
        return !(root.hasAttribute(ATTR) || window.contentScriptInjected);
      },
    });

    if (result) {
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        files: ["contentScript.js"],
      });
    }
    return true;
  } catch (e) {
    console.error("Failed to ensure content script injection", e);
    return false;
  }
}

const createDefaultStore = () => ({
  stats: {
    total: 0,
    recent: [],
  },
  jobs: {},
  lastResetAt: Date.now(),
});

let jobBidStore = createDefaultStore();
let jobBidStatusState = {
  state: "idle",
  jobUrl: "",
  buttonText: "",
  matchedUrl: "",
  timestamp: Date.now(),
};

function normalizeStore(rawStore) {
  const defaults = createDefaultStore();
  if (!rawStore || typeof rawStore !== "object") return defaults;

  const stats = rawStore.stats && typeof rawStore.stats === "object" ? rawStore.stats : {};
  const normalizedStats = {
    total: Number.isFinite(stats.total) ? stats.total : 0,
    recent: Array.isArray(stats.recent) ? stats.recent.slice(0, MAX_RECENT_JOB_EVENTS) : [],
  };

  const normalizedJobs = {};
  const rawJobs = rawStore.jobs && typeof rawStore.jobs === "object" ? rawStore.jobs : {};
  for (const [key, value] of Object.entries(rawJobs)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      normalizedJobs[key] = value;
    }
  }
  const jobEntries = Object.entries(normalizedJobs).sort((a, b) => a[1] - b[1]);
  const trimmedJobs =
    jobEntries.length > MAX_TRACKED_JOBS
      ? Object.fromEntries(jobEntries.slice(jobEntries.length - MAX_TRACKED_JOBS))
      : normalizedJobs;

  const lastResetAt = Number.isFinite(rawStore.lastResetAt)
    ? rawStore.lastResetAt
    : defaults.lastResetAt;

  return {
    stats: normalizedStats,
    jobs: trimmedJobs,
    lastResetAt,
  };
}

function safeSendMessage(message) {
  try {
    const result = chrome.runtime?.sendMessage?.(message);
    if (result && typeof result.catch === "function") {
      result.catch(() => {});
    }
  } catch (e) {
    // Ignore missing receivers; log unexpected errors
    if (!/Receiving end does not exist/.test(String(e))) {
      console.error("Failed to send runtime message", e);
    }
  }
}

function storageGet(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(result?.[key] ?? null);
    });
  });
}

function storageSet(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(value, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

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

  console.log("[scrapeQueue] POST", `${baseUrl}/jobs/ingest`, `(${batch.length} jobs)`);
  let response;
  try {
    response = await fetch(`${baseUrl}/jobs/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

async function drainScrapeQueue() {
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

function persistJobBidStore() {
  try {
    chrome.storage?.local?.set({ [JOB_BID_STORAGE_KEY]: jobBidStore }, () => {
      if (chrome.runtime.lastError) {
        console.error("Failed to persist job bid store", chrome.runtime.lastError);
      }
    });
  } catch (e) {
    console.error("Error persisting job bid store", e);
  }
}

function broadcastJobBidStats() {
  const payload = {
    total: jobBidStore.stats.total,
    recent: jobBidStore.stats.recent,
    lastResetAt: jobBidStore.lastResetAt,
  };
  safeSendMessage({ action: "jobBidStats", payload });
}

function broadcastJobBidStatusState() {
  safeSendMessage({ action: "jobBidStatus:update", payload: jobBidStatusState });
}

function updateJobBidStatus(nextState) {
  jobBidStatusState = {
    ...jobBidStatusState,
    ...nextState,
    timestamp: nextState?.timestamp || Date.now(),
  };
  broadcastJobBidStatusState();
}

function normalizeJobUrl(jobUrl) {
  if (!jobUrl || typeof jobUrl !== "string") return null;
  try {
    const parsed = new URL(jobUrl);
    parsed.hash = "";
    let pathname = parsed.pathname || "";
    pathname = pathname.replace(/\/+$/, "");
    if (!pathname.startsWith("/")) pathname = `/${pathname}`;
    const params = new URLSearchParams(parsed.search || "");
    const sortedEntries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    const normalizedSearch = sortedEntries.length
      ? `?${sortedEntries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")}`
      : "";
    return `${parsed.origin}${pathname}${normalizedSearch}`;
  } catch (e) {
    console.error("Failed to normalize job URL", e);
    return jobUrl.trim() || null;
  }
}

function sameHost(urlA, urlB) {
  try {
    const hostA = new URL(urlA).host;
    const hostB = new URL(urlB).host;
    return hostA === hostB;
  } catch (e) {
    console.error("Failed to compare hosts for URLs", e);
    return false;
  }
}

function findDuplicateJob(jobKey) {
  if (!jobKey) return null;
  for (const [storedKey, firstDetectedAt] of Object.entries(jobBidStore.jobs)) {
    if (!storedKey) continue;
    if (storedKey === jobKey) {
      return { storedKey, firstDetectedAt };
    }
    if (sameHost(jobKey, storedKey) && (storedKey.includes(jobKey) || jobKey.includes(storedKey))) {
      return { storedKey, firstDetectedAt };
    }
  }
  return null;
}

function notifyDuplicate(jobUrl, buttonText, firstDetectedAt, matchedUrl) {
  const payload = {
    jobUrl: jobUrl || "",
    buttonText: buttonText || "",
    firstDetectedAt,
    againDetectedAt: Date.now(),
    matchedUrl: matchedUrl || "",
  };
  safeSendMessage({ action: "jobBidDuplicate", payload });
  updateJobBidStatus({
    state: "duplicate",
    jobUrl: jobUrl || matchedUrl || "",
    buttonText: buttonText || "",
    firstDetectedAt,
    matchedUrl: matchedUrl || "",
  });
}

function enforceJobLimit() {
  const jobEntries = Object.entries(jobBidStore.jobs);
  if (jobEntries.length <= MAX_TRACKED_JOBS) return;
  jobEntries.sort((a, b) => a[1] - b[1]);
  jobBidStore.jobs = Object.fromEntries(jobEntries.slice(jobEntries.length - MAX_TRACKED_JOBS));
}

function withStoreReady(task) {
  if (storeReady) {
    task();
    return;
  }
  pendingStoreTasks.push(task);
}

function flushPendingStoreTasks() {
  if (!pendingStoreTasks.length) return;
  const tasks = pendingStoreTasks.splice(0, pendingStoreTasks.length);
  for (const task of tasks) {
    try {
      task();
    } catch (e) {
      console.error("Pending store task failed", e);
    }
  }
}

function recordJobBid(payload) {
  withStoreReady(() => {
    const timestamp = payload?.timestamp || Date.now();
    const jobUrl = payload?.jobUrl || payload?.urlAfter || payload?.urlBefore || "";
    const jobKey = normalizeJobUrl(jobUrl);

    const duplicate = findDuplicateJob(jobKey);
    if (duplicate) {
      notifyDuplicate(jobUrl, payload?.buttonText, duplicate.firstDetectedAt, duplicate.storedKey);
      return;
    }

    if (jobKey) {
      jobBidStore.jobs[jobKey] = timestamp;
      enforceJobLimit();
    }

    jobBidStore.stats.total += 1;
    const recentEvent = {
      id: timestamp,
      buttonText: payload?.buttonText || "",
      buttonSignature: payload?.buttonSignature || "",
      reason: payload?.reason || "unknown",
      jobUrl: jobUrl,
      urlBefore: payload?.urlBefore || "",
      urlAfter: payload?.urlAfter || "",
      matchedKeyword: payload?.matchedKeyword || null,
      domChangePercent:
        typeof payload?.domChangePercent === "number" ? payload.domChangePercent : null,
      timestamp,
    };
    jobBidStore.stats.recent = [recentEvent, ...jobBidStore.stats.recent].slice(
      0,
      MAX_RECENT_JOB_EVENTS,
    );
    persistJobBidStore();
    broadcastJobBidStats();
    updateJobBidStatus({
      state: "counted",
      jobUrl,
      buttonText: payload?.buttonText || "",
      matchedUrl: "",
    });
  });
}

function resetJobBidStats() {
  withStoreReady(() => {
    jobBidStore = createDefaultStore();
    persistJobBidStore();
    broadcastJobBidStats();
    updateJobBidStatus({ state: "idle", jobUrl: "" });
  });
}

function loadJobBidStore() {
  try {
    chrome.storage?.local?.get(JOB_BID_STORAGE_KEY, (items) => {
      if (chrome.runtime.lastError) {
        console.error("Failed to read job bid store", chrome.runtime.lastError);
        jobBidStore = createDefaultStore();
        persistJobBidStore();
        storeReady = true;
        flushPendingStoreTasks();
        broadcastJobBidStats();
        broadcastJobBidStatusState();
        return;
      }
      const stored = items?.[JOB_BID_STORAGE_KEY];
      if (!stored) {
        jobBidStore = createDefaultStore();
        persistJobBidStore();
        storeReady = true;
        flushPendingStoreTasks();
        broadcastJobBidStats();
        broadcastJobBidStatusState();
        return;
      }
      jobBidStore = normalizeStore(stored);
      storeReady = true;
      flushPendingStoreTasks();
      broadcastJobBidStats();
      broadcastJobBidStatusState();
    });
  } catch (e) {
    console.error("Error loading job bid store", e);
    jobBidStore = createDefaultStore();
    storeReady = true;
    flushPendingStoreTasks();
    broadcastJobBidStats();
    broadcastJobBidStatusState();
  }
}

function handleJobBidMessage(message) {
  switch (message?.action) {
    case "jobBidApplied":
      recordJobBid(message.payload || {});
      return true;
    case "jobBidStatus":
      updateJobBidStatus(message.payload || {});
      return true;
    case "jobBidStatus:get":
      broadcastJobBidStatusState();
      return true;
    case "jobBid:getStats":
      broadcastJobBidStats();
      return true;
    case "jobBid:reset":
      resetJobBidStats();
      return true;
    default:
      return false;
  }
}

loadJobBidStore();
persistSpiritApiUrlToStorage();
persistJobApiUrlToStorage();
const scrapeQueueInitialization = initializeScrapeQueue().catch((error) => {
  console.error("Failed to initialize scrape registration queue", error);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm?.name === SCRAPE_QUEUE_ALARM) void drainScrapeQueue();
});

// Messages coming from content scripts that should be relayed to the extension UI
// Listen for messages from the UI and forward them to the content script or to backend
function readStorageValue(key) {
  return new Promise((resolve) => {
    try {
      chrome.storage?.local?.get?.(key, (result) => {
        if (chrome.runtime?.lastError) {
          resolve(null);
          return;
        }
        resolve(result?.[key] ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

function normalizeBaseUrl(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "";
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === "scrapeQueue:enqueue") {
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
    return true;
  }

  if (message?.action === "scrapeQueue:clear") {
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
    return true;
  }

  if (message?.action === "scrapeQueue:getState") {
    (async () => {
      await scrapeQueueInitialization;
      const runId = typeof message.payload?.runId === "string" ? message.payload.runId : null;
      sendResponse?.({ success: true, state: scrapeQueueSnapshot(runId) });
    })().catch((error) => sendResponse?.({ success: false, error: error.message }));
    return true;
  }

  if (message?.action === "scrapeQueue:recordOutcome") {
    (async () => {
      await scrapeQueueInitialization;
      const { runId, outcome } = message.payload || {};
      if (!runId) throw new Error("runId is required");
      recordScrapeQueueOutcome(runId, outcome);
      await persistScrapeQueue();
      broadcastScrapeQueue(runId);
      sendResponse?.({ success: true });
    })().catch((error) => sendResponse?.({ success: false, error: error.message }));
    return true;
  }

  // Content script -> background: read a local file via core-backend and return base64.
  if (message?.action === "readLocalFile") {
    (async () => {
      try {
        const baseUrl = normalizeBaseUrl(await readStorageValue("spiritApiBaseUrl"));
        if (!baseUrl) {
          sendResponse?.({ success: false, error: "spiritApiBaseUrl not set" });
          return;
        }

        const filePath = message?.payload?.path;
        if (!filePath || typeof filePath !== "string") {
          sendResponse?.({ success: false, error: "Missing payload.path" });
          return;
        }

        const resp = await fetch(`${baseUrl}/local-file`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: filePath }),
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          sendResponse?.({
            success: false,
            error: `local-file failed (${resp.status}): ${text || resp.statusText}`,
          });
          return;
        }
        const data = await resp.json();
        sendResponse?.({ success: true, data });
      } catch (e) {
        sendResponse?.({ success: false, error: String((e && e.message) || e) });
      }
    })();

    return true;
  }

  // UI -> background command: open multiple tabs (payload: { urls: [] })
  if (message.action === "open-tabs") {
    const urls = message.payload && Array.isArray(message.payload.urls) ? message.payload.urls : [];
    if (!urls.length) return;
    for (const url of urls) {
      try {
        chrome.tabs.create({ url, active: false });
      } catch (e) {
        console.error("Failed to open tab for", url, e);
      }
    }
    return;
  }

  if (handleJobBidMessage(message)) {
    return;
  }

  if (actionsToForward.includes(message.action)) {
    (async () => {
      const targetTab = await resolveTargetTab(message);
      if (!targetTab?.id) {
        console.warn("No target tab found for action", message.action);
        if (message.action === "highlightByPattern" || message.action === "clearHighlight") {
          safeSendMessage({
            action: "highlightResult",
            payload: {
              success: false,
              count: 0,
              error: "No active page tab found. Focus the job page and try again.",
            },
          });
        }
        return;
      }
      const targetTabId = targetTab.id;
      chrome.tabs.sendMessage(targetTabId, message, { frameId: 0 }, () => {
        if (!chrome.runtime.lastError) return;
        const lastErrorMessage = chrome.runtime.lastError?.message || "";
        // Only attempt the guarded injection if the receiver is missing (navigation/new page).
        if (!/Receiving end does not exist|Could not establish connection/i.test(lastErrorMessage))
          return;

        ensureContentScriptInjected(targetTabId)
          .then(() => {
            try {
              chrome.tabs.sendMessage(targetTabId, message, { frameId: 0 }, () => {
                // Read lastError so Chrome does not surface a noisy unchecked runtime warning.
                void chrome.runtime.lastError;
              });
            } catch (e) {
              console.error("Failed to send message after ensuring contentScript", e);
            }
          })
          .catch((err) => {
            console.error("Failed to ensure contentScript before resend", err);
          });
      });
    })();
    return;
  }
});
