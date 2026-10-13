import { IncompleteJobDataError } from "../../api/jobValidation.js";
import { SCRAPE_OUTCOMES } from "../../api/scrapeRunStats.js";
import {
  createAdaptiveBackoff,
  DEFAULT_BACKOFF_BASE_MS,
  DEFAULT_BACKOFF_MAX_MS,
  detectPageBlock,
  isTransientBlock,
} from "../../routineKit/backoff.js";
import { reportDeclaredFields } from "../../routineKit/declaredFields.js";
import { NAVIGATE_UNTIL_DOM_READY } from "../../routineKit/protocol.js";
import {
  RoutineBlockedError,
  RoutineFinishedError,
  RoutineStoppedError,
} from "../../routineKit/runner.js";

import { saveListCardHeart } from "./clickHeart.js";
import {
  CARD_DECISION_OPENED,
  CARD_SKIP_DETAIL_SAVED,
  CARD_SKIP_HANDLED,
  CARD_SKIP_HEART_SAVED,
  CARD_SKIP_NO_URL,
  CARD_SKIP_SAVED_BADGE,
  DETAIL_READY_MS,
  DETAIL_READY_POLL_MS,
  emptyPageLabel,
  HEART_INNER,
  INVALID_STREAK,
  INVALID_STREAK_MESSAGE,
  JOB_DELAY_MS,
  jitterMs,
  LIST_READY_MS,
  MAX_PAGE,
  NAVIGATE_WAIT_MS,
  PAGE_DELAY_MS,
  PAGE_STUCK_AFTER_NEXT_MESSAGE,
  PAGE_UNPROCESSED_MESSAGE,
  RETRY_PAUSE_MS,
  SIGN_IN_TO_SAVE_MESSAGE,
  STUCK_LOGIN_MESSAGE,
  STUCK_LOGIN_STREAK,
  STUCK_PAGE_FAILURES,
  stuckPageMessage,
  WAIT_UNTIL,
  cardDecisionLabel,
  cardExtractFailedDecision,
  cardInvalidDecision,
} from "./constants.js";
import { jobCardSelector, jobSaveSelector } from "./cssEscape.js";
import { isJobDetailReady } from "./detailReady.js";
import { cardsAfterCursor, isJobHandled } from "./handled.js";
import { isHeartSaved, isListCardSaved } from "./heart.js";
import { advanceCursor, canAdvanceBuiltinPage, cardIdKey, cursorForTab } from "./lists.js";
import { clickNextPage, openListForCursor, rememberObservedListUrl } from "./paginate.js";
import { parseDetail, requiredRecordIssues } from "./parseDetail.js";
import { parseList } from "./parseList.js";
import { isSignedOutSession } from "./signedOut.js";
import { createBuiltinStore } from "./store.js";
import { waitInPage } from "./waitInPage.js";

const START_PAGE_KEY = "builtin:start";

function jobRecord(detail) {
  const { meta: _meta, ...record } = detail;
  return record;
}

function warnIfPageEmpty(hooks, page, cardCount) {
  if (cardCount !== 0) return;
  const label = emptyPageLabel(page);
  hooks.onActivity?.({
    phase: "open",
    label,
    kind: "waitFor",
  });
  console.warn(label);
}

async function finishIfNothingLeft(store, parsed, pageIds, lastPageIds) {
  if (!parsed.hasNextPage && (parsed.cards.length === 0 || (pageIds && pageIds === lastPageIds))) {
    await store.clearCursor();
    throw new RoutineFinishedError("Nothing left to process on Built In");
  }
}

function nextInvalidStreak(streak) {
  const next = streak + 1;
  if (next >= INVALID_STREAK) {
    throw new RoutineBlockedError(INVALID_STREAK_MESSAGE);
  }
  return next;
}

export function noteExtractProblem(hooks, jobId, decision, outcome) {
  const label = cardDecisionLabel(jobId, decision);
  hooks.onActivity?.({
    phase: "dismiss",
    label,
    kind: "waitFor",
  });
  hooks.recordOutcome?.(outcome);
  hooks.onNotice?.(label, false);
}

function throwIfSignedOut(html, isLoggedIn) {
  if (isSignedOutSession({ html, isLoggedIn })) {
    throw new RoutineBlockedError(SIGN_IN_TO_SAVE_MESSAGE);
  }
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
  return {
    html: result?.html || "",
    url: result?.url || "",
    status: result?.status || 200,
  };
}

async function ensureCursor(store, tab) {
  const existing = await store.loadCursor();
  const cursor = cursorForTab(tab.url, existing);
  if (cursor !== existing) await store.saveCursor(cursor);
  return cursor;
}

async function finishOrAdvanceListPage({
  store,
  parsed,
  pageIds,
  listPageUrl,
  cursor,
  handledIds,
  clickNext,
  pause,
}) {
  const allHandled =
    parsed.cards.length > 0 && parsed.cards.every((item) => isJobHandled(item, handledIds));
  if (
    !canAdvanceBuiltinPage({
      cardCount: parsed.cards.length,
      pageProcessed: cursor.pageProcessed ?? 0,
      allHandled,
    })
  ) {
    if (parsed.cards.length === 0 && !parsed.hasNextPage) {
      await store.clearCursor();
      throw new RoutineFinishedError("Nothing left to process on Built In");
    }
    throw new RoutineBlockedError(
      parsed.cards.length === 0 ? emptyPageLabel(cursor.page) : PAGE_UNPROCESSED_MESSAGE,
    );
  }
  if (!parsed.hasNextPage) {
    await store.clearCursor();
    throw new RoutineFinishedError("Nothing left to process on Built In");
  }
  const moved = await clickNext({
    previousPageIds: pageIds,
    previousUrl: listPageUrl,
  });
  if (!moved?.found) {
    await store.clearCursor();
    throw new RoutineFinishedError("Nothing left to process on Built In");
  }
  if (!moved.advanced) {
    throw new RoutineBlockedError(PAGE_STUCK_AFTER_NEXT_MESSAGE);
  }
  let next = { ...advanceCursor(cursor, { nextPage: true }), lastPageIds: pageIds };
  next = rememberObservedListUrl(next, moved.page?.url || "");
  await store.saveCursor(next);
  await pause(PAGE_DELAY_MS);
  return { cursor: next, page: moved.page };
}

/** Parse, report fields, and enqueue. Skips stay on the caller so the cursor can move. */
export async function extractOpenedJob(ctx, progress, card, detailPage, handledIds, invalidStreak) {
  const { hooks } = ctx;
  const jobId = card.id;
  let detail;
  try {
    const parse = hooks.parseDetail ?? parseDetail;
    detail = parse(detailPage.html, detailPage.url || card.url, {
      companyName: card.companyName,
    });
  } catch (error) {
    noteExtractProblem(hooks, jobId, cardExtractFailedDecision(error), SCRAPE_OUTCOMES.FAILED);
    return { jobId, invalidStreak: nextInvalidStreak(invalidStreak), skipped: true };
  }
  const detailId = detail.meta.id || card.id;
  if (isJobHandled({ id: detailId, isSaved: detail.meta.isSaved }, handledIds)) {
    return { jobId, detailId, savedOnPage: true, invalidStreak };
  }
  const record = jobRecord(detail);
  try {
    await reportDeclaredFields(ctx, progress, record);
  } catch (error) {
    noteExtractProblem(hooks, jobId, cardExtractFailedDecision(error), SCRAPE_OUTCOMES.FAILED);
    return { jobId, detailId, invalidStreak: nextInvalidStreak(invalidStreak), skipped: true };
  }
  const issues = requiredRecordIssues(record);
  if (issues.length) {
    noteExtractProblem(hooks, jobId, cardInvalidDecision(issues), SCRAPE_OUTCOMES.VALIDATION);
    return { jobId, detailId, invalidStreak: nextInvalidStreak(invalidStreak), skipped: true };
  }
  hooks.onActivity?.({ phase: "submit", label: "Saving record" });
  try {
    await hooks.onRecord?.(record);
  } catch (error) {
    if (error instanceof IncompleteJobDataError || error?.name === "IncompleteJobDataError") {
      const fields = error.issues?.length ? error.issues : issues;
      noteExtractProblem(hooks, jobId, cardInvalidDecision(fields), SCRAPE_OUTCOMES.VALIDATION);
      return { jobId, detailId, invalidStreak: nextInvalidStreak(invalidStreak), skipped: true };
    }
    throw error;
  }
  return { jobId, detailId, detail, invalidStreak: 0 };
}

/**
 * One visible job: navigate the same tab to the card href, read the job page,
 * enqueue, then restore the exact stored list URL and click that list-card heart. Never fetches
 * in the background. A block backs off and resumes; a timeout is retried.
 * 403 / 429 / captcha back off without limit. Repeated sign-in redirects,
 * a signed-out save wall, or N dead-page failures (404/410 or the page never
 * loading) stop the run.
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
  let invalidStreak = 0;
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
          error instanceof RoutineBlockedError ||
          error instanceof IncompleteJobDataError ||
          error?.name === "IncompleteJobDataError"
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
      await call(
        "navigate",
        { url, timeout: NAVIGATE_WAIT_MS, until: NAVIGATE_UNTIL_DOM_READY },
        NAVIGATE_WAIT_MS,
      );
      return readVisiblePage(call);
    }, url);
  };

  const waitForDetailReady = async () => {
    if (!skipDelays) {
      const ready = await waitInPage(call, WAIT_UNTIL.DETAIL, {}, DETAIL_READY_MS);
      if (ready) return readVisiblePage(call);
    }
    let page = await readVisiblePage(call);
    if (isJobDetailReady(page.html)) return page;
    hooks.onActivity?.({
      phase: "ready",
      label: "Waiting for job page data",
      kind: "waitFor",
    });
    if (skipDelays) {
      page = await readVisiblePage(call);
      return page;
    }
    const deadline = Date.now() + DETAIL_READY_MS;
    while (Date.now() < deadline) {
      ctx.checkStopped();
      await rest(DETAIL_READY_POLL_MS);
      page = await readVisiblePage(call);
      if (isJobDetailReady(page.html)) return page;
    }
    return page;
  };

  const clickNext = (previous) =>
    clickNextPage({
      call,
      readPage: () => readVisiblePage(call),
      rest,
      skipDelays,
      checkStopped: ctx.checkStopped,
      onActivity: hooks.onActivity,
      ...previous,
    });

  const openList = (label, phase, alreadyOpen) =>
    openListForCursor({
      cursor,
      openVisible,
      clickNext,
      alreadyOpen,
      label,
      phase,
      pause,
    });

  /** Navigation resolves at DOMContentLoaded; let Alpine and my-item hydrate before parsing. */
  const settleList = async (page) => {
    if (skipDelays) return page;
    const ready = await waitInPage(call, WAIT_UNTIL.LIST_READY, {}, LIST_READY_MS);
    return ready && !ready.immediate ? readVisiblePage(call) : page;
  };

  const queryHeart = (jobId) =>
    call("shadow", { host: jobSaveSelector(jobId), inner: HEART_INNER, action: "query" });

  const noteCardDecision = (cardId, decision, phase = "dismiss", kind = "waitFor") => {
    hooks.onActivity?.({
      phase,
      label: cardDecisionLabel(cardId, decision),
      kind,
    });
  };

  const markProcessed = async (jobId, { handle = false } = {}) => {
    if (!jobId) return;
    if (handle) handledIds = await store.markHandled(jobId, handledIds);
    cursor = {
      ...cursor,
      lastJobId: jobId,
      pageProcessed: (cursor.pageProcessed ?? 0) + 1,
    };
    await store.saveCursor(cursor);
  };

  const markJob = async (jobId) => markProcessed(jobId, { handle: true });

  const advancePast = async (jobId) => {
    if (!jobId) return;
    cursor = { ...cursor, lastJobId: jobId };
    await store.saveCursor(cursor);
  };

  const pickNextCard = async (cards, lastJobId) => {
    for (const candidate of cardsAfterCursor(cards, lastJobId)) {
      if (isJobHandled(candidate, handledIds)) {
        noteCardDecision(candidate.id, CARD_SKIP_HANDLED);
        await markProcessed(candidate.id);
        continue;
      }
      const heart = await queryHeart(candidate.id);
      if (
        isListCardSaved({
          heart,
          hasSaveHost: candidate.hasSaveHost,
          hasVisibleSavedBadge: candidate.hasVisibleSavedBadge,
        })
      ) {
        noteCardDecision(
          candidate.id,
          heart?.found && isHeartSaved(heart) ? CARD_SKIP_HEART_SAVED : CARD_SKIP_SAVED_BADGE,
        );
        await markProcessed(candidate.id);
        continue;
      }
      return candidate;
    }
    return null;
  };

  hooks.onActivity?.({ phase: "open", label: "Loading job list", kind: "waitFor" });
  const tab = await withRetry(() => readVisiblePage(call), START_PAGE_KEY);
  progress.tick();
  cursor = await ensureCursor(store, tab);
  let pendingListPage = null;

  for (;;) {
    ctx.checkStopped();
    if (cursor.page > MAX_PAGE) {
      await store.clearCursor();
      throw new RoutineFinishedError("Built In crawl hit the page cap");
    }
    const listUrl = cursor.lists[cursor.listIndex] || cursor.startUrl;
    if (!listUrl) {
      await store.clearCursor();
      throw new RoutineFinishedError("Nothing left to process on Built In");
    }

    hooks.onActivity?.({
      phase: "open",
      label: `Page ${cursor.page}`,
      kind: "waitFor",
    });
    emitCursor();
    const listPage = await settleList(
      await openList(`Opening page ${cursor.page}`, "open", pendingListPage),
    );
    pendingListPage = null;
    if (await handleBlock(listPage, listPage.url || listUrl)) continue;
    const observed = rememberObservedListUrl(cursor, listPage.url || listUrl);
    if (observed !== cursor) {
      cursor = observed;
      await store.saveCursor(cursor);
    }

    const parsed = parseList(listPage.html, listPage.url || listUrl);
    const pageIds = cardIdKey(parsed.cards);
    warnIfPageEmpty(hooks, cursor.page, parsed.cards.length);
    await finishIfNothingLeft(store, parsed, pageIds, cursor.lastPageIds);
    if (parsed.cards.length) throwIfSignedOut(listPage.html);

    const card = await pickNextCard(parsed.cards, cursor.lastJobId);

    if (!card) {
      const advanced = await finishOrAdvanceListPage({
        store,
        parsed,
        pageIds,
        listPageUrl: listPage.url || listUrl,
        cursor,
        handledIds,
        clickNext,
        pause,
      });
      cursor = advanced.cursor;
      pendingListPage = advanced.page;
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
      noteCardDecision(card.id, CARD_SKIP_NO_URL);
      await advancePast(card.id);
      continue;
    }
    noteCardDecision(card.id, CARD_DECISION_OPENED, "open", "click");

    const returnToList = () => openList("Returning to job list", "settle");
    const opened = await openVisible(card.url, "Opening job");
    if (await handleBlock(opened, card.url)) {
      await returnToList();
      continue;
    }
    const detailPage = await waitForDetailReady();
    if (await handleBlock(detailPage, card.url)) {
      await returnToList();
      continue;
    }

    progress.tick();
    const extracted = await extractOpenedJob(
      ctx,
      progress,
      card,
      detailPage,
      handledIds,
      invalidStreak,
    );
    invalidStreak = extracted.invalidStreak;
    const jobId = extracted.jobId;
    if (extracted.savedOnPage) {
      noteCardDecision(jobId, CARD_SKIP_DETAIL_SAVED);
      await markJob(jobId);
      if (extracted.detailId !== jobId) await markJob(extracted.detailId);
      await returnToList();
      continue;
    }
    if (extracted.skipped) {
      await advancePast(jobId);
      await returnToList();
      continue;
    }
    await markJob(jobId);
    if (extracted.detailId !== jobId) await markJob(extracted.detailId);

    const listAfter = await returnToList();
    if (await handleBlock(listAfter, listAfter.url || listUrl)) {
      backoff.onSuccess();
      progress.tick();
      return;
    }
    throwIfSignedOut(listAfter.html, extracted.detail.meta.isLoggedIn);
    const heart = await saveListCardHeart({
      jobId,
      call,
      rest,
      checkStopped: ctx.checkStopped,
      skipDelays,
      onActivity: hooks.onActivity,
      readPage: () => readVisiblePage(call),
    });
    emitCursor({
      card: jobId,
      cardIndex,
      cardsOnPage: parsed.cards.length,
      heartDelta: { hearted: heart.saved ? 1 : 0, notHearted: heart.saved ? 0 : 1 },
    });
    if (heart.signedOut) throw new RoutineBlockedError(SIGN_IN_TO_SAVE_MESSAGE);
    backoff.onSuccess();
    await pause(JOB_DELAY_MS);
    progress.tick();
    return;
  }
}
