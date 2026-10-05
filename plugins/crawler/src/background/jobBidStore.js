/* global chrome */
import { normalizeJobUrl, sameHost } from "./jobUrl.js";
import { safeSendMessage } from "./runtime.js";

const JOB_BID_STORAGE_KEY = "jobBidStore";
const MAX_RECENT_JOB_EVENTS = 5;
const MAX_TRACKED_JOBS = 500;
const pendingStoreTasks = [];
let storeReady = false;

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

export function loadJobBidStore() {
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

export function handleJobBidMessage(message) {
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
