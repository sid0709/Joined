import { IncompleteJobDataError } from "../../api/jobValidation.js";
import { SCRAPE_OUTCOMES } from "../../api/scrapeRunStats.js";
import {
  createAdaptiveBackoff,
  DEFAULT_BACKOFF_BASE_MS,
  DEFAULT_BACKOFF_MAX_MS,
} from "../../routineKit/backoff.js";
import { reportDeclaredFields } from "../../routineKit/declaredFields.js";
import { RoutineBlockedError, RoutineFinishedError } from "../../routineKit/runner.js";

import { isHiringCafeSignedOut } from "./appliedState.js";
import { detectHiringCafeBlock, isTransientBlock } from "./challenge.js";
import {
  CARD_DECISION_MARK_ONLY,
  CARD_DECISION_OPENED,
  CARD_SKIP_ALREADY_APPLIED,
  CARD_SKIP_DETAIL_HANDLED,
  CARD_SKIP_HANDLED,
  CARD_SKIP_INGEST_NOT_ACCEPTED,
  CARD_SKIP_INGEST_REJECTED,
  CARD_SKIP_INGEST_TIMEOUT,
  CARD_SKIP_METADATA_SIZE,
  CARD_SKIP_NO_URL,
  NOT_MARKED_REASON,
  INVALID_STREAK,
  INVALID_STREAK_MESSAGE,
  JOB_DELAY_MS,
  MAX_PAGE,
  PAGE_DELAY_MS,
  SIGN_IN_TO_MARK_MESSAGE,
  START_PAGE_KEY,
  STUCK_PAGE_FAILURES,
  cardDecisionLabel,
  cardInvalidDecision,
  displayPage,
  emptyPageLabel,
  jobCardSelector,
  jitterMs,
  notMarkedLog,
  stuckPageMessage,
} from "./constants.js";
import { expandShortGroups } from "./expandGroups.js";
import { isJobHandled, jobsAfterCursor } from "./handled.js";
import { advanceCursor, crawlListUrl, emptyCursor, jobIdKey, listUrlForPage } from "./lists.js";
import {
  markAppliedOnCard,
  markAppliedOnDetail,
  readAppliedOnCard,
  resolveMarkAfterDetail,
} from "./markApplied.js";
import {
  createOpenVisible,
  createWaitForDetailReady,
  createWithRetry,
  readVisiblePage,
  stripTrailingSlash,
  waitForChallengeClear,
} from "./page.js";
import { parseDetail, recordReadyToEnqueue } from "./parseDetail.js";
import { parseList } from "./parseList.js";
import { createHiringCafeStore } from "./store.js";

function jobRecord(detail) {
  const { meta: _meta, ...record } = detail;
  return record;
}

function warnIfPageEmpty(hooks, page, jobCount) {
  if (jobCount !== 0) return;
  const label = emptyPageLabel(page);
  hooks.onActivity?.({
    phase: "open",
    label,
    kind: "waitFor",
  });
  console.warn(label);
}

async function listedJobs(listPage, pageUrl, { call, rest, skipDelays, readPage }) {
  const url = listPage.url || pageUrl;
  return expandShortGroups({
    parsed: parseList(listPage.html, url),
    call,
    rest,
    skipDelays,
    readPage,
    pageUrl: url,
  });
}

function warnGroupShortfalls(hooks, shortfalls) {
  for (const shortfall of shortfalls ?? []) {
    console.warn(shortfall.label);
    hooks.onNotice?.(shortfall.label, false);
  }
}

function throwIfSignedOut(html, markAppliedEnabled) {
  if (!markAppliedEnabled) return;
  if (isHiringCafeSignedOut(html)) {
    throw new RoutineBlockedError(SIGN_IN_TO_MARK_MESSAGE);
  }
}

async function finishIfNothingLeft(store, parsed, pageIds, lastPageIds) {
  if (parsed.isLastPage && parsed.jobs.length === 0) {
    await store.clearCursor();
    throw new RoutineFinishedError("Nothing left to process on HiringCafe");
  }
  if (pageIds && pageIds === lastPageIds) {
    await store.clearCursor();
    throw new RoutineFinishedError("Nothing left to process on HiringCafe");
  }
}

function nextInvalidStreak(streak) {
  const next = streak + 1;
  if (next >= INVALID_STREAK) {
    throw new RoutineBlockedError(INVALID_STREAK_MESSAGE);
  }
  return next;
}

async function ensureCursor(store, tab) {
  const existing = await store.loadCursor();
  if (existing?.lists?.length) return existing;
  const cursor = emptyCursor([crawlListUrl(tab.url)]);
  await store.saveCursor(cursor);
  return cursor;
}

async function pickNextJob({
  jobs,
  lastJobId,
  handledIds,
  noteJobDecision,
  recordOutcome,
  markJob,
  readApplied,
  markAppliedEnabled,
}) {
  for (const candidate of jobsAfterCursor(jobs, lastJobId)) {
    if (isJobHandled(candidate, handledIds)) {
      if (!markAppliedEnabled) {
        noteJobDecision(candidate.id, CARD_SKIP_HANDLED);
        recordOutcome?.(SCRAPE_OUTCOMES.DUPLICATE);
        continue;
      }
      const applied = await readApplied(candidate);
      if (applied.signedOut) throw new RoutineBlockedError(SIGN_IN_TO_MARK_MESSAGE);
      if (applied.marked) {
        noteJobDecision(candidate.id, CARD_SKIP_ALREADY_APPLIED);
        recordOutcome?.(SCRAPE_OUTCOMES.DUPLICATE);
        continue;
      }
      noteJobDecision(candidate.id, CARD_DECISION_MARK_ONLY);
      recordOutcome?.(SCRAPE_OUTCOMES.DUPLICATE);
      return { ...candidate, markOnly: true };
    }
    if (!markAppliedEnabled) return candidate;
    const applied = await readApplied(candidate);
    if (applied.signedOut) throw new RoutineBlockedError(SIGN_IN_TO_MARK_MESSAGE);
    if (applied.marked) {
      noteJobDecision(candidate.id, CARD_SKIP_ALREADY_APPLIED);
      recordOutcome?.(SCRAPE_OUTCOMES.DUPLICATE);
      await markJob(candidate.id);
      continue;
    }
    return candidate;
  }
  return null;
}

function markDeltaOf(result) {
  return {
    marked: result?.marked ? 1 : 0,
    notMarked: result?.marked ? 0 : 1,
    reason: result?.marked ? "" : String(result?.reason || result?.log || "").trim(),
    log: result?.log || "",
  };
}

function ingestSkipOf(accepted) {
  if (accepted === false) {
    return {
      decision: CARD_SKIP_INGEST_REJECTED,
      reason: NOT_MARKED_REASON.INGEST_REJECTED,
    };
  }
  if (accepted === null) {
    return {
      decision: CARD_SKIP_INGEST_TIMEOUT,
      reason: NOT_MARKED_REASON.INGEST_TIMEOUT,
    };
  }
  return {
    decision: CARD_SKIP_INGEST_NOT_ACCEPTED,
    reason: NOT_MARKED_REASON.NOT_ACCEPTED,
  };
}

async function finishMarkOnList({
  marked,
  emitCursor,
  jobId,
  jobIndex,
  jobsOnPage,
  backoff,
  pause,
  progress,
}) {
  emitCursor({
    card: jobId,
    cardIndex: jobIndex,
    cardsOnPage: jobsOnPage,
    jobIndex,
    jobsOnPage,
    markDelta: markDeltaOf(marked),
  });
  if (marked.signedOut) throw new RoutineBlockedError(SIGN_IN_TO_MARK_MESSAGE);
  backoff.onSuccess();
  await pause(JOB_DELAY_MS);
  progress.tick();
}

/**
 * One visible job: navigate the same tab to the posting, read `__NEXT_DATA__`,
 * enqueue, wait for a confirmed 2xx, Mark Applied, then return to `?page=N`.
 * Never fetches in the background. 403 / 429 back off without limit. A
 * Turnstile challenge waits for the user. Signed-out pauses only when Mark
 * Applied is on.
 */
export async function runHiringCafePass(ctx, progress) {
  const { hooks, call, rest } = ctx;
  const store = hooks.store ?? createHiringCafeStore();
  const skipDelays = Boolean(hooks.skipDelays);
  const markAppliedEnabled = await store.loadMarkAppliedEnabled();
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
  let invalidStreak = 0;
  const pageFailures = new Map();

  const emitCursor = (extra = {}) => {
    const jobIndex = extra.jobIndex ?? extra.cardIndex;
    const jobsOnPage = extra.jobsOnPage ?? extra.cardsOnPage;
    const snapshot = {
      page: displayPage(cursor?.page),
      card: extra.card ?? cursor?.lastJobId ?? "",
      blockCount: backoff.blockCount,
      blocks: backoff.blocks.map((entry) => ({ kind: entry.kind, at: entry.at })),
      ...extra,
    };
    if (jobIndex != null) {
      snapshot.jobIndex = jobIndex;
      snapshot.cardIndex = extra.cardIndex ?? jobIndex;
    } else {
      delete snapshot.jobIndex;
      delete snapshot.cardIndex;
    }
    if (jobsOnPage != null) {
      snapshot.jobsOnPage = jobsOnPage;
      snapshot.cardsOnPage = extra.cardsOnPage ?? jobsOnPage;
    } else {
      delete snapshot.jobsOnPage;
      delete snapshot.cardsOnPage;
    }
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

  const withRetry = createWithRetry({
    ctx,
    skipDelays,
    rest,
    notePageFailure,
    onActivity: hooks.onActivity,
  });
  const openVisible = createOpenVisible({ withRetry, call, onActivity: hooks.onActivity });
  const waitForDetailReady = createWaitForDetailReady({
    call,
    rest,
    skipDelays,
    onActivity: hooks.onActivity,
    checkStopped: ctx.checkStopped,
  });
  const readPage = () => readVisiblePage(call);

  const handleBlock = async (page, intendedUrl) => {
    const detected = detectHiringCafeBlock(page);
    if (!detected.blocked) return false;
    if (detected.kind === "challenge") {
      await waitForChallengeClear({
        ctx,
        call,
        rest,
        skipDelays,
        onActivity: hooks.onActivity,
        onNotice: hooks.onNotice,
      });
      emitCursor({ lastBlock: detected.kind });
      return true;
    }
    hooks.onActivity?.({
      phase: "settle",
      label: `Backing off (${detected.kind})`,
      kind: "pause",
    });
    if (!isTransientBlock(detected.kind)) {
      notePageFailure(intendedUrl || page.url);
    }
    await backoff.onBlock({ kind: detected.kind });
    emitCursor({ lastBlock: detected.kind });
    return true;
  };

  const noteJobDecision = (jobId, decision, phase = "dismiss", kind = "waitFor") => {
    hooks.onActivity?.({
      phase,
      label: cardDecisionLabel(jobId, decision),
      kind,
    });
  };

  const markJob = async (jobId) => {
    if (!jobId) return;
    handledIds = await store.markHandled(jobId, handledIds);
    cursor = { ...cursor, lastJobId: jobId };
    await store.saveCursor(cursor);
  };

  const advancePast = async (jobId) => {
    if (!jobId) return;
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
      throw new RoutineFinishedError("HiringCafe crawl hit the page cap");
    }
    const listUrl = cursor.lists[cursor.listIndex];
    if (!listUrl) {
      await store.clearCursor();
      throw new RoutineFinishedError("Nothing left to process on HiringCafe");
    }

    const pageUrl = listUrlForPage(listUrl, cursor.page);
    hooks.onActivity?.({
      phase: "open",
      label: `Page ${displayPage(cursor.page)}`,
      kind: "waitFor",
    });
    emitCursor();
    const listPage = await openVisible(pageUrl, `Opening page ${displayPage(cursor.page)}`);
    if (await handleBlock(listPage, pageUrl)) continue;
    throwIfSignedOut(listPage.html, markAppliedEnabled);

    const parsed = await listedJobs(listPage, pageUrl, {
      call,
      rest,
      skipDelays,
      readPage,
    });
    const pageIds = jobIdKey(parsed.jobs);
    warnIfPageEmpty(hooks, cursor.page, parsed.jobs.length);
    warnGroupShortfalls(hooks, parsed.shortfalls);
    await finishIfNothingLeft(store, parsed, pageIds, cursor.lastPageIds);

    const job = await pickNextJob({
      jobs: parsed.jobs,
      lastJobId: cursor.lastJobId,
      handledIds,
      noteJobDecision,
      recordOutcome: hooks.recordOutcome,
      markJob,
      markAppliedEnabled,
      readApplied: (candidate) =>
        readAppliedOnCard({
          job: candidate,
          call,
          rest,
          skipDelays,
          readPage,
        }),
    });
    if (!job) {
      if (parsed.isLastPage) {
        await store.clearCursor();
        throw new RoutineFinishedError("Nothing left to process on HiringCafe");
      }
      cursor = { ...advanceCursor(cursor, { nextPage: true }), lastPageIds: pageIds };
      await store.saveCursor(cursor);
      await pause(PAGE_DELAY_MS);
      continue;
    }

    const jobIndex = parsed.jobs.findIndex((item) => item.id === job.id) + 1;
    emitCursor({
      card: job.id,
      cardIndex: jobIndex,
      cardsOnPage: parsed.jobs.length,
      jobIndex,
      jobsOnPage: parsed.jobs.length,
    });
    hooks.onActivity?.({
      phase: "open",
      label: `Page ${displayPage(cursor.page)} · job ${jobIndex} of ${parsed.jobs.length}`,
      kind: "click",
    });
    await call("highlight", { selector: jobCardSelector(job) }).catch(() => {});
    const markArgs = {
      job,
      call,
      rest,
      skipDelays,
      onActivity: hooks.onActivity,
      onNotice: hooks.onNotice,
      readPage,
      enabled: markAppliedEnabled,
    };
    if (job.markOnly) {
      await finishMarkOnList({
        marked: await markAppliedOnCard(markArgs),
        emitCursor,
        jobId: job.id,
        jobIndex,
        jobsOnPage: parsed.jobs.length,
        backoff,
        pause,
        progress,
      });
      return;
    }
    if (!job.url) {
      noteJobDecision(job.id, CARD_SKIP_NO_URL);
      await advancePast(job.id);
      continue;
    }
    noteJobDecision(job.id, CARD_DECISION_OPENED, "open", "click");

    const opened = await openVisible(job.url, "Opening job");
    if (await handleBlock(opened, job.url)) {
      await openVisible(pageUrl, "Returning to job list", "settle");
      continue;
    }
    const detailPage = await waitForDetailReady();
    if (await handleBlock(detailPage, job.url)) {
      await openVisible(pageUrl, "Returning to job list", "settle");
      continue;
    }

    progress.tick();
    const detail = parseDetail(detailPage.html, detailPage.url || job.url, {
      companyName: job.companyName,
      applyUrl: job.applyUrl,
      postedRaw: job.postedRaw,
      cardHref: job.url,
    });
    const jobId = job.id;
    const detailId = detail.meta.id || job.id;
    if (isJobHandled({ id: detailId }, handledIds)) {
      noteJobDecision(jobId, CARD_SKIP_DETAIL_HANDLED);
      hooks.recordOutcome?.(SCRAPE_OUTCOMES.DUPLICATE);
      await markJob(jobId);
      if (detailId !== jobId) await markJob(detailId);
      const listAfterHandled = await openVisible(pageUrl, "Returning to job list", "settle");
      if (await handleBlock(listAfterHandled, pageUrl)) {
        backoff.onSuccess();
        progress.tick();
        return;
      }
      throwIfSignedOut(listAfterHandled.html, markAppliedEnabled);
      await finishMarkOnList({
        marked: await markAppliedOnCard(markArgs),
        emitCursor,
        jobId,
        jobIndex,
        jobsOnPage: parsed.jobs.length,
        backoff,
        pause,
        progress,
      });
      return;
    }

    const record = jobRecord(detail);
    const ready = recordReadyToEnqueue(record);
    if (!ready.ok && ready.reason === "metadata-size") {
      noteJobDecision(jobId, CARD_SKIP_METADATA_SIZE);
      await advancePast(jobId);
      await openVisible(pageUrl, "Returning to job list", "settle");
      continue;
    }
    if (ready.issues.length) {
      invalidStreak = nextInvalidStreak(invalidStreak);
      noteJobDecision(jobId, cardInvalidDecision(ready.issues));
      await advancePast(jobId);
      await openVisible(pageUrl, "Returning to job list", "settle");
      continue;
    }

    await reportDeclaredFields(ctx, progress, record);
    hooks.onActivity?.({ phase: "submit", label: "Saving record" });
    let accepted;
    try {
      accepted = await hooks.onRecord?.(record);
    } catch (error) {
      if (error instanceof IncompleteJobDataError || error?.name === "IncompleteJobDataError") {
        invalidStreak = nextInvalidStreak(invalidStreak);
        const fields = error.issues?.length ? error.issues : ready.issues;
        noteJobDecision(jobId, cardInvalidDecision(fields));
        await advancePast(jobId);
        await openVisible(pageUrl, "Returning to job list", "settle");
        continue;
      }
      throw error;
    }
    if (accepted !== true) {
      const { decision, reason } = ingestSkipOf(accepted);
      const log = notMarkedLog(jobId, reason);
      noteJobDecision(jobId, decision);
      hooks.onNotice?.(log, false);
      hooks.recordOutcome?.(SCRAPE_OUTCOMES.FAILED);
      emitCursor({
        card: jobId,
        cardIndex: jobIndex,
        cardsOnPage: parsed.jobs.length,
        jobIndex,
        jobsOnPage: parsed.jobs.length,
        markDelta: { marked: 0, notMarked: 1, reason, log },
      });
      await advancePast(jobId);
      await openVisible(pageUrl, "Returning to job list", "settle");
      continue;
    }
    invalidStreak = 0;
    await markJob(jobId);
    if (detailId !== jobId) await markJob(detailId);

    if (!markAppliedEnabled) {
      backoff.onSuccess();
      await pause(JOB_DELAY_MS);
      progress.tick();
      return;
    }

    const detailMark = await markAppliedOnDetail(markArgs);
    if (detailMark.signedOut) throw new RoutineBlockedError(SIGN_IN_TO_MARK_MESSAGE);

    const listAfter = await openVisible(pageUrl, "Returning to job list", "settle");
    if (await handleBlock(listAfter, pageUrl)) {
      backoff.onSuccess();
      progress.tick();
      return;
    }
    throwIfSignedOut(listAfter.html, markAppliedEnabled);
    await finishMarkOnList({
      marked: await resolveMarkAfterDetail(detailMark, markArgs),
      emitCursor,
      jobId,
      jobIndex,
      jobsOnPage: parsed.jobs.length,
      backoff,
      pause,
      progress,
    });
    return;
  }
}
