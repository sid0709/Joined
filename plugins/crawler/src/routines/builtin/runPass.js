import {
  createAdaptiveBackoff,
  DEFAULT_BACKOFF_BASE_MS,
  DEFAULT_BACKOFF_MAX_MS,
  detectPageBlock,
  isTransientBlock,
} from "../../routineKit/backoff.js";
import { reportDeclaredFields } from "../../routineKit/declaredFields.js";
import {
  RoutineBlockedError,
  RoutineFinishedError,
  RoutineStepError,
  RoutineStoppedError,
} from "../../routineKit/runner.js";

import {
  HEART_CONFIRM_MS,
  HEART_INNER,
  HEART_POLL_MS,
  HEART_UNREAD_LABEL,
  JOB_DELAY_MS,
  jitterMs,
  MAX_PAGE,
  NAVIGATE_WAIT_MS,
  PAGE_DELAY_MS,
  RETRY_PAUSE_MS,
  STUCK_LOGIN_MESSAGE,
  STUCK_LOGIN_STREAK,
  STUCK_PAGE_FAILURES,
  stuckPageMessage,
} from "./constants.js";
import { jobCardSelector, jobSaveSelector } from "./cssEscape.js";
import { isJobHandled, nextUnhandledCard } from "./handled.js";
import { isHeartSaved } from "./heart.js";
import { advanceCursor, cardIdKey, crawlListUrl, emptyCursor, listUrlForPage } from "./lists.js";
import { parseDetail } from "./parseDetail.js";
import { parseList } from "./parseList.js";
import { createBuiltinStore } from "./store.js";

const START_PAGE_KEY = "builtin:start";

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

function isTimeoutError(error) {
  return /timed out/i.test(String(error?.message || error || ""));
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

function sameUrl(left, right) {
  return stripTrailingSlash(left) === stripTrailingSlash(right);
}

async function readVisiblePage(call) {
  const result = await call("html");
  if (!result?.html && !detectPageBlock(result).blocked) {
    throw new RoutineStepError("The page did not return HTML");
  }
  return {
    html: result?.html || "",
    url: result?.url || "",
    status: result?.status || 200,
  };
}

async function ensureCursor(store, tab) {
  const existing = await store.loadCursor();
  if (existing?.lists?.length) return existing;
  const cursor = emptyCursor([crawlListUrl(tab.url)]);
  await store.saveCursor(cursor);
  return cursor;
}

/**
 * One visible job: navigate the same tab to the card href, read the job page,
 * enqueue, then return to ?page=N and click that list-card heart. Never fetches
 * in the background. A block backs off and resumes; a timeout is retried.
 * 403 / 429 / captcha back off without limit. Repeated sign-in redirects or
 * N dead-page failures (404/410 or the page never loading) stop the run.
 */
export async function runBuiltInPass(ctx, progress) {
  const { hooks, call, rest } = ctx;
  const store = hooks.store ?? createBuiltinStore();
  const skipDelays = Boolean(hooks.skipDelays);
  const backoff = createAdaptiveBackoff({
    maxConcurrency: 1,
    minConcurrency: 1,
    maxBlocks: Number.POSITIVE_INFINITY,
    pauseMs: DEFAULT_BACKOFF_BASE_MS,
    maxPauseMs: DEFAULT_BACKOFF_MAX_MS,
    now: hooks.now,
    random: hooks.random,
    sleep: (ms) => (skipDelays ? Promise.resolve() : rest(ms)),
  });
  let handledIds = await store.loadHandledIds();
  let cursor;
  let consecutiveLogins = 0;
  const pageFailures = new Map();

  const emitCursor = (extra = {}) => {
    const snapshot = {
      page: cursor?.page,
      card: extra.card ?? cursor?.lastJobId ?? "",
      cardIndex: extra.cardIndex,
      cardsOnPage: extra.cardsOnPage,
      blockCount: backoff.blockCount,
      blocks: backoff.blocks.map((entry) => ({ kind: entry.kind, at: entry.at })),
      ...extra,
    };
    hooks.onPace?.(snapshot);
  };

  const pause = async (range) => {
    if (!skipDelays) await rest(jitterMs(range, hooks.random ?? Math.random));
  };

  const notePageFailure = (url) => {
    const key = stripTrailingSlash(url || "");
    if (!key) return;
    const count = (pageFailures.get(key) || 0) + 1;
    pageFailures.set(key, count);
    if (count >= STUCK_PAGE_FAILURES) {
      throw new RoutineBlockedError(stuckPageMessage(count));
    }
  };

  const handleBlock = async (page, intendedUrl) => {
    const detected = detectPageBlock(page);
    if (!detected.blocked) {
      consecutiveLogins = 0;
      return false;
    }
    hooks.onActivity?.({
      phase: "settle",
      label: `Backing off (${detected.kind})`,
      kind: "pause",
    });
    if (detected.kind === "login") {
      consecutiveLogins += 1;
      if (consecutiveLogins >= STUCK_LOGIN_STREAK) {
        throw new RoutineBlockedError(STUCK_LOGIN_MESSAGE);
      }
    } else {
      consecutiveLogins = 0;
      if (!isTransientBlock(detected.kind)) {
        notePageFailure(intendedUrl || page.url);
      }
    }
    await backoff.onBlock({ kind: detected.kind });
    emitCursor({ lastBlock: detected.kind });
    return true;
  };

  const withRetry = async (fn, pageUrl) => {
    for (;;) {
      ctx.checkStopped();
      try {
        return await fn();
      } catch (error) {
        if (
          isAbortError(error) ||
          error instanceof RoutineFinishedError ||
          error instanceof RoutineBlockedError
        ) {
          throw error;
        }
        notePageFailure(pageUrl);
        hooks.onActivity?.({
          phase: "ready",
          label: isTimeoutError(error) ? "Retrying after timeout" : "Retrying after a page error",
          kind: "waitFor",
        });
        if (!skipDelays) await rest(RETRY_PAUSE_MS);
      }
    }
  };

  const openVisible = async (url, label, phase = "open") => {
    return withRetry(async () => {
      const current = await readVisiblePage(call);
      if (sameUrl(current.url, url) && current.html) return current;
      hooks.onActivity?.({ phase, label, kind: "click" });
      await call("navigate", { url, timeout: NAVIGATE_WAIT_MS }, NAVIGATE_WAIT_MS);
      return readVisiblePage(call);
    }, url);
  };

  const queryHeart = (jobId) =>
    call("shadow", { host: jobSaveSelector(jobId), inner: HEART_INNER, action: "query" });

  const isCardSavedLive = async (card) => {
    const state = await queryHeart(card.id);
    return Boolean(state?.found) && isHeartSaved(state);
  };

  const clickListHeart = async (jobId) => {
    const host = jobSaveSelector(jobId);
    const before = await queryHeart(jobId);
    if (isHeartSaved(before)) return true;
    if (!before?.found) {
      const label = `${HEART_UNREAD_LABEL} (${jobId})`;
      hooks.onActivity?.({ phase: "dismiss", label, kind: "waitFor" });
      console.warn(label);
      return false;
    }
    hooks.onActivity?.({ phase: "dismiss", label: "Saving job on Built In", kind: "click" });
    await call("highlight", { selector: host });
    await call("shadow", { host, inner: HEART_INNER, action: "click" });
    const deadline = Date.now() + (skipDelays ? 0 : HEART_CONFIRM_MS);
    for (;;) {
      ctx.checkStopped();
      const next = await queryHeart(jobId);
      if (isHeartSaved(next)) return true;
      if (Date.now() >= deadline) return false;
      await rest(HEART_POLL_MS);
    }
  };

  const markJob = async (jobId) => {
    if (!jobId) return;
    handledIds = await store.markHandled(jobId, handledIds);
    cursor = { ...cursor, lastJobId: jobId };
    await store.saveCursor(cursor);
  };

  hooks.onActivity?.({ phase: "open", label: "Loading job list", kind: "waitFor" });
  const tab = await withRetry(() => readVisiblePage(call), START_PAGE_KEY);
  progress.tick();
  cursor = await ensureCursor(store, tab);

  for (;;) {
    ctx.checkStopped();
    if (cursor.page > MAX_PAGE) {
      await store.clearCursor();
      throw new RoutineFinishedError("Built In crawl hit the page cap");
    }
    const listUrl = cursor.lists[cursor.listIndex];
    if (!listUrl) {
      await store.clearCursor();
      throw new RoutineFinishedError("Nothing left to process on Built In");
    }

    const pageUrl = listUrlForPage(listUrl, cursor.page);
    hooks.onActivity?.({
      phase: "open",
      label: `Page ${cursor.page}`,
      kind: "waitFor",
    });
    emitCursor();
    const listPage = await openVisible(pageUrl, `Opening page ${cursor.page}`);
    if (await handleBlock(listPage, pageUrl)) continue;

    const parsed = parseList(listPage.html, listPage.url || pageUrl);
    const pageIds = cardIdKey(parsed.cards);
    if (!parsed.nextPageUrl && parsed.cards.length === 0) {
      await store.clearCursor();
      throw new RoutineFinishedError("Nothing left to process on Built In");
    }
    if (pageIds && pageIds === cursor.lastPageIds) {
      await store.clearCursor();
      throw new RoutineFinishedError("Nothing left to process on Built In");
    }

    let card = nextUnhandledCard(parsed.cards, handledIds, cursor.lastJobId);
    while (card && (await isCardSavedLive(card))) {
      await markJob(card.id);
      card = nextUnhandledCard(parsed.cards, handledIds, card.id);
    }

    if (!card) {
      if (!parsed.nextPageUrl || parsed.cards.length === 0) {
        await store.clearCursor();
        throw new RoutineFinishedError("Nothing left to process on Built In");
      }
      cursor = { ...advanceCursor(cursor, { nextPage: true }), lastPageIds: pageIds };
      await store.saveCursor(cursor);
      await pause(PAGE_DELAY_MS);
      continue;
    }

    const cardIndex = parsed.cards.findIndex((item) => item.id === card.id) + 1;
    emitCursor({ card: card.id, cardIndex, cardsOnPage: parsed.cards.length });
    hooks.onActivity?.({
      phase: "open",
      label: `Page ${cursor.page} · card ${cardIndex} of ${parsed.cards.length}`,
      kind: "click",
    });
    await call("highlight", { selector: jobCardSelector(card.id) });
    if (!card.url) {
      await markJob(card.id);
      continue;
    }

    const detailPage = await openVisible(card.url, "Opening job");
    if (await handleBlock(detailPage, card.url)) {
      await openVisible(pageUrl, "Returning to job list", "settle");
      continue;
    }

    progress.tick();
    const detail = parseDetail(detailPage.html, detailPage.url || card.url);
    const jobId = card.id;
    const detailId = detail.meta.id || card.id;
    if (isJobHandled({ id: detailId, isSaved: detail.meta.isSaved }, handledIds)) {
      await markJob(jobId);
      if (detailId !== jobId) await markJob(detailId);
      await openVisible(pageUrl, "Returning to job list", "settle");
      continue;
    }

    const record = jobRecord(detail);
    await reportDeclaredFields(ctx, progress, record);
    hooks.onActivity?.({ phase: "submit", label: "Saving record" });
    await hooks.onRecord?.(record);
    await markJob(jobId);
    if (detailId !== jobId) await markJob(detailId);

    const listAfter = await openVisible(pageUrl, "Returning to job list", "settle");
    if (await handleBlock(listAfter, pageUrl)) {
      backoff.onSuccess();
      progress.tick();
      return;
    }
    await clickListHeart(jobId);
    backoff.onSuccess();
    emitCursor({ card: jobId, cardIndex, cardsOnPage: parsed.cards.length });
    await pause(JOB_DELAY_MS);
    progress.tick();
    return;
  }
}
