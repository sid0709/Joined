import {
  BACKOFF_RAMP_EVERY,
  BLOCK_WINDOW_MS,
  clampPaceSettings,
  DEFAULT_PACE_SETTINGS,
  MAX_BLOCKS_IN_WINDOW,
  MIN_CONCURRENCY,
  TOKEN_BUCKET_CAPACITY,
  WORKER_JITTER_MS,
} from "../../api/paceSettings.js";
import {
  createAdaptiveBackoff,
  DEFAULT_BACKOFF_BASE_MS,
  DEFAULT_BACKOFF_MAX_MS,
  detectFetchBlock,
  MAX_RETRY_AFTER_MS,
} from "../../routineKit/backoff.js";
import { reportDeclaredFields } from "../../routineKit/declaredFields.js";
import { newFetchId } from "../../routineKit/fetchId.js";
import { createPaceMeter } from "../../routineKit/paceMeter.js";
import {
  RoutineBlockedError,
  RoutineFinishedError,
  RoutineStepError,
  RoutineStoppedError,
} from "../../routineKit/runner.js";
import { createTokenBucket } from "../../routineKit/tokenBucket.js";
import { createWorkerPool } from "../../routineKit/workerPool.js";

import { jitterMs, MAX_PAGE } from "./constants.js";
import { jobSaveSelector } from "./cssEscape.js";
import { contiguousLastJobId, isJobHandled, unhandledCards } from "./handled.js";
import {
  advanceCursor,
  cardIdKey,
  emptyCursor,
  listUrlForPage,
  listUrlsFromBoard,
} from "./lists.js";
import { parseDetail } from "./parseDetail.js";
import { parseList } from "./parseList.js";
import { createBuiltinStore } from "./store.js";

function jobRecord(detail) {
  const { meta: _meta, ...record } = detail;
  return record;
}

function isAbortError(error) {
  return (
    error instanceof RoutineStoppedError ||
    error?.name === "RoutineStoppedError" ||
    error?.name === "AbortError"
  );
}

async function currentPage(call) {
  const result = await call("html");
  if (!result?.html) throw new RoutineStepError("The page did not return HTML");
  return {
    html: result.html,
    url: result.url || "",
    status: result.status || 200,
    retryAfter: result.retryAfter,
  };
}

async function fetchPage(call, url) {
  try {
    const result = await call("fetch", { url, fetchId: newFetchId() });
    if (!result?.html && !detectFetchBlock(result).blocked) {
      throw new RoutineStepError(`Failed to fetch ${url}`);
    }
    return {
      html: result?.html || "",
      url: result?.url || url,
      status: result?.status || 0,
      retryAfter: result?.retryAfter || "",
    };
  } catch (error) {
    if (isAbortError(error)) throw new RoutineStoppedError();
    throw error;
  }
}

function stripTrailingSlash(url) {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/$/, "");
    return parsed.href;
  } catch {
    return url;
  }
}

async function loadListPage(call, tab, listUrl, takePace) {
  if (tab?.url && stripTrailingSlash(tab.url) === stripTrailingSlash(listUrl)) return tab;
  if (takePace) await takePace();
  return fetchPage(call, listUrl);
}

async function ensureCursor(store, tab) {
  const existing = await store.loadCursor();
  if (existing?.lists?.length) return existing;
  const list = parseList(tab.html, tab.url);
  const cursor = emptyCursor(listUrlsFromBoard(list.board, tab.url));
  await store.saveCursor(cursor);
  return cursor;
}

function nextCursorAfterPage(cursor, parsed) {
  const pageIds = cardIdKey(parsed.cards);
  const repeated = Boolean(pageIds) && pageIds === cursor.lastPageIds;
  const canPaginate = Boolean(parsed.nextPageUrl) && parsed.cards.length > 0 && !repeated;
  if (canPaginate) {
    return { ...advanceCursor(cursor, { nextPage: true }), lastPageIds: pageIds };
  }
  return advanceCursor(cursor, { nextList: true });
}

function emitPace(hooks, meter, backoff, extra = {}) {
  const snapshot = {
    jobsPerSecond: Number(meter.jobsPerSecond().toFixed(2)),
    concurrency: backoff.concurrency,
    blockCount: backoff.blockCount,
    ...extra,
  };
  console.debug("[crawler:builtin] pace", snapshot);
  hooks.onPace?.(snapshot);
}

/**
 * One crawl: prefetch list pages, fetch details through a worker pool, and
 * enqueue asynchronously. Stop cancels in-flight fetches. A job is marked
 * handled only after enqueue succeeds.
 */
export async function runBuiltInPass(ctx, progress) {
  const { hooks, call, rest } = ctx;
  const store = hooks.store ?? createBuiltinStore();
  const settings = clampPaceSettings(hooks.pace ?? DEFAULT_PACE_SETTINGS);
  const skipDelays = Boolean(hooks.skipDelays);
  const bucket = createTokenBucket({
    rate: skipDelays ? Infinity : settings.jobsPerSecond,
    capacity: TOKEN_BUCKET_CAPACITY,
    now: hooks.now,
    sleep: (ms) => rest(ms),
  });
  const takePace = async ({ jitter = false } = {}) => {
    await bucket.take();
    if (!skipDelays && jitter) {
      await rest(jitterMs(WORKER_JITTER_MS, hooks.random ?? Math.random));
    }
  };
  const backoff = createAdaptiveBackoff({
    maxConcurrency: settings.concurrency,
    minConcurrency: MIN_CONCURRENCY,
    maxBlocks: MAX_BLOCKS_IN_WINDOW,
    windowMs: BLOCK_WINDOW_MS,
    pauseMs: DEFAULT_BACKOFF_BASE_MS,
    maxPauseMs: DEFAULT_BACKOFF_MAX_MS,
    maxRetryAfterMs: MAX_RETRY_AFTER_MS,
    rampEvery: BACKOFF_RAMP_EVERY,
    now: hooks.now,
    random: hooks.random,
    sleep: (ms) => (skipDelays ? Promise.resolve() : rest(ms)),
  });
  const pool = createWorkerPool({
    getConcurrency: () => backoff.concurrency,
    signal: hooks.signal,
  });
  const meter = createPaceMeter({ now: hooks.now });
  const listCache = new Map();
  let clickQueue = Promise.resolve();
  let writeQueue = Promise.resolve();
  let handledIds;
  let cursor;
  let stopReason = null;

  const serializeWrite = (fn) => {
    const next = writeQueue.then(fn, fn);
    writeQueue = next.catch(() => {});
    return next;
  };

  const handleBlock = async (page, label) => {
    const detected = detectFetchBlock(page);
    if (!detected.blocked) return false;
    hooks.onActivity?.({ phase: "settle", label: `Backing off (${detected.kind})`, kind: "pause" });
    const result = await backoff.onBlock({ retryAfter: page.retryAfter, kind: detected.kind });
    emitPace(hooks, meter, backoff, { event: detected.kind, url: page.url });
    if (result.stop) {
      stopReason = `Built In blocked the crawl (${result.blockCount} blocks). Stopped to protect the session.`;
      throw new RoutineBlockedError(stopReason);
    }
    void label;
    return true;
  };

  async function cachedList(listUrl) {
    if (!listCache.has(listUrl)) {
      listCache.set(
        listUrl,
        (async () => {
          const page = await loadListPage(call, tab, listUrl, takePace);
          await handleBlock(page, listUrl);
          return { page, parsed: parseList(page.html, page.url) };
        })(),
      );
    }
    return listCache.get(listUrl);
  }

  function prefetch(url) {
    if (!url || listCache.has(url)) return;
    void cachedList(url).catch((error) => {
      if (!isAbortError(error) && !(error instanceof RoutineBlockedError)) {
        console.debug("[crawler:builtin] prefetch failed", url, error);
      }
      listCache.delete(url);
    });
  }

  async function markJob(jobId) {
    handledIds = await serializeWrite(async () => {
      const nextHandled = await store.markHandled(jobId, handledIds);
      const lastJobId = contiguousLastJobId(currentCards, nextHandled, cursor.lastJobId);
      cursor = { ...cursor, lastJobId };
      await store.saveCursor(cursor);
      return nextHandled;
    });
  }

  async function maybeClickSave(detail) {
    if (!detail.meta.isSignedIn || detail.meta.isSaved || !detail.meta.id) return;
    clickQueue = clickQueue.then(async () => {
      ctx.checkStopped();
      await call("click", { selector: jobSaveSelector(detail.meta.id), wait: 0 });
    });
    await clickQueue;
  }

  async function processCard(card) {
    ctx.checkStopped();
    if (!card.url) {
      await markJob(card.id);
      return;
    }
    await takePace({ jitter: true });
    ctx.checkStopped();
    hooks.onActivity?.({ phase: "ready", label: "Opening job", kind: "waitFor" });
    const detailPage = await fetchPage(call, card.url);
    if (await handleBlock(detailPage, card.url)) {
      return processCard(card);
    }
    progress.tick();
    const detail = parseDetail(detailPage.html, detailPage.url || card.url);
    const jobId = card.id;
    const detailId = detail.meta.id || card.id;
    if (isJobHandled({ id: detailId, isSaved: detail.meta.isSaved }, handledIds)) {
      await markJob(jobId);
      if (detailId !== jobId) await markJob(detailId);
      return;
    }
    const record = jobRecord(detail);
    await reportDeclaredFields(ctx, progress, record);
    hooks.onActivity?.({ phase: "submit", label: "Saving record" });
    await hooks.onRecord?.(record);
    await markJob(jobId);
    if (detailId !== jobId) await markJob(detailId);
    hooks.onActivity?.({ phase: "dismiss", label: "Marking job handled", kind: "click" });
    await maybeClickSave(detail);
    meter.mark();
    backoff.onSuccess();
    emitPace(hooks, meter, backoff, { jobId });
    progress.tick();
  }

  hooks.onActivity?.({ phase: "open", label: "Loading job list", kind: "waitFor" });
  const tab = await currentPage(call);
  progress.tick();

  handledIds = await store.loadHandledIds();
  cursor = await ensureCursor(store, tab);
  const maxSteps = MAX_PAGE * Math.max(cursor.lists.length, 1) + 1;
  let steps = 0;
  let currentCards = [];

  for (;;) {
    ctx.checkStopped();
    steps += 1;
    if (steps > maxSteps) {
      await store.clearCursor();
      throw new RoutineFinishedError("Built In crawl hit the page cap");
    }
    const listUrl = cursor.lists[cursor.listIndex];
    if (!listUrl) {
      await store.clearCursor();
      throw new RoutineFinishedError("Nothing left to process on Built In");
    }

    hooks.onActivity?.({
      phase: "open",
      label: `List ${cursor.listIndex + 1}/${cursor.lists.length}, page ${cursor.page}`,
      kind: "waitFor",
    });
    emitPace(hooks, meter, backoff, { listUrl, page: cursor.page });
    const pageUrl = listUrlForPage(listUrl, cursor.page);
    const { parsed } = await cachedList(pageUrl);
    const pageIds = cardIdKey(parsed.cards);
    currentCards = parsed.cards;

    if (pageIds && pageIds === cursor.lastPageIds) {
      cursor = advanceCursor(cursor, { nextList: true });
      await store.saveCursor(cursor);
      continue;
    }
    if (parsed.nextPageUrl) prefetch(listUrlForPage(listUrl, cursor.page + 1));

    const cards = unhandledCards(parsed.cards, handledIds, cursor.lastJobId);
    if (!cards.length) {
      cursor = nextCursorAfterPage(cursor, parsed);
      await store.saveCursor(cursor);
      continue;
    }

    const results = await Promise.allSettled(
      cards.map((card) => pool.run(() => processCard(card))),
    );
    const blocked = results.find(
      (result) => result.status === "rejected" && result.reason instanceof RoutineBlockedError,
    );
    if (blocked) throw blocked.reason;
    const stopped = results.find(
      (result) => result.status === "rejected" && isAbortError(result.reason),
    );
    if (stopped) throw new RoutineStoppedError();
    const failed = results.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;

    cursor = nextCursorAfterPage(cursor, parsed);
    await store.saveCursor(cursor);
  }
}
