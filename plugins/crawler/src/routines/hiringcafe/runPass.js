import { IncompleteJobDataError } from "../../api/jobValidation.js";
import { SCRAPE_OUTCOMES } from "../../api/scrapeRunStats.js";
import {
  createAdaptiveBackoff,
  DEFAULT_BACKOFF_BASE_MS,
  DEFAULT_BACKOFF_MAX_MS,
} from "../../routineKit/backoff.js";
import { reportDeclaredFields } from "../../routineKit/declaredFields.js";
import { DETAIL_TAB_BATCH } from "../../routineKit/detailTabs.js";
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
  FILTERS_CHANGED_NOTICE,
  NOT_MARKED_REASON,
  INVALID_STREAK,
  INVALID_STREAK_MESSAGE,
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
import { fetchHiringCafeDetails } from "./detailTabs.js";
import { expandShortGroups } from "./expandGroups.js";
import { isJobHandled, jobsAfterCursor } from "./handled.js";
import {
  advanceCursor,
  crawlListUrl,
  emptyCursor,
  isClassicListUrl,
  jobIdKey,
  listUrlForPage,
  sameListFilters,
} from "./lists.js";
import { markAppliedOnCard, readAppliedOnCard } from "./markApplied.js";
import { clickNextPage } from "./nextPage.js";
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

async function ensureMarkDebugger(call, enabled) {
  if (!enabled) return;
  await call("attachDebugger").catch(() => {});
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

async function listedJobs(listPage, pageUrl, { call, rest, skipDelays, readPage, random }) {
  const url = listPage.url || pageUrl;
  return expandShortGroups({
    parsed: parseList(listPage.html, url),
    call,
    rest,
    skipDelays,
    readPage,
    pageUrl: url,
    random,
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

/**
 * Resume the saved cursor unless a run starts on a classic list with other
 * filters: the tab's search wins, so a stale cursor never drops `searchState`.
 */
async function ensureCursor(store, tab, { firstPass = false, onNotice } = {}) {
  const existing = await store.loadCursor();
  const savedList = existing?.lists?.[existing.listIndex ?? 0];
  const tabList = isClassicListUrl(tab.url) ? crawlListUrl(tab.url) : "";
  const adoptTab = firstPass && tabList && savedList && !sameListFilters(savedList, tabList);
  if (existing?.lists?.length && !adoptTab) return existing;
  const cursor = emptyCursor([tabList || crawlListUrl(tab.url)]);
  await store.saveCursor(cursor);
  if (adoptTab) onNotice?.(FILTERS_CHANGED_NOTICE, true);
  return cursor;
}

function emitAppliedSkip(emitCursor, candidate, jobs) {
  const jobIndex = jobs.findIndex((item) => item.id === candidate.id) + 1;
  emitCursor?.({
    card: candidate.id,
    cardIndex: jobIndex,
    cardsOnPage: jobs.length,
    jobIndex,
    jobsOnPage: jobs.length,
    skipDelta: { skippedApplied: 1 },
  });
}

export async function pickNextJob({
  jobs,
  lastJobId,
  handledIds,
  noteJobDecision,
  recordOutcome,
  markJob,
  readApplied,
  markAppliedEnabled,
  emitCursor,
}) {
  for (const candidate of jobsAfterCursor(jobs, lastJobId)) {
    if (candidate.listApplied) {
      noteJobDecision(candidate.id, CARD_SKIP_ALREADY_APPLIED);
      recordOutcome?.(SCRAPE_OUTCOMES.DUPLICATE);
      emitAppliedSkip(emitCursor, candidate, jobs);
      continue;
    }
    if (isJobHandled(candidate, handledIds)) {
      if (!markAppliedEnabled) {
        noteJobDecision(candidate.id, CARD_SKIP_HANDLED);
        recordOutcome?.(SCRAPE_OUTCOMES.DUPLICATE);
        continue;
      }
      const applied = await readApplied(candidate);
      if (applied.challenge) return { challenge: true };
      if (applied.signedOut) throw new RoutineBlockedError(SIGN_IN_TO_MARK_MESSAGE);
      if (applied.marked) {
        noteJobDecision(candidate.id, CARD_SKIP_ALREADY_APPLIED);
        recordOutcome?.(SCRAPE_OUTCOMES.DUPLICATE);
        emitAppliedSkip(emitCursor, candidate, jobs);
        continue;
      }
      noteJobDecision(candidate.id, CARD_DECISION_MARK_ONLY);
      recordOutcome?.(SCRAPE_OUTCOMES.DUPLICATE);
      return { ...candidate, markOnly: true };
    }
    if (!markAppliedEnabled) return candidate;
    const applied = await readApplied(candidate);
    if (applied.challenge) return { challenge: true };
    if (applied.signedOut) throw new RoutineBlockedError(SIGN_IN_TO_MARK_MESSAGE);
    if (applied.marked) {
      noteJobDecision(candidate.id, CARD_SKIP_ALREADY_APPLIED);
      recordOutcome?.(SCRAPE_OUTCOMES.DUPLICATE);
      emitAppliedSkip(emitCursor, candidate, jobs);
      await markJob(candidate.id);
      continue;
    }
    return candidate;
  }
  return null;
}

/**
 * Up to `limit` jobs after the cursor, in page order, using the same skips as
 * pickNextJob. A challenge before the first pick stops the batch.
 */
export async function pickJobBatch({ jobs, lastJobId, limit, ...pickArgs }) {
  const picked = [];
  let after = lastJobId;
  while (picked.length < limit) {
    const job = await pickNextJob({ ...pickArgs, jobs, lastJobId: after });
    if (job?.challenge) return picked.length ? { jobs: picked } : { challenge: true, jobs: [] };
    if (!job) break;
    picked.push(job);
    after = job.id;
  }
  return { jobs: picked };
}

/** Report fields, then send every decided record at once and wait for each accept. */
async function submitBatch(ctx, progress, outcomes) {
  const submits = outcomes.filter((outcome) => outcome.action === "submit");
  for (const outcome of submits) await reportDeclaredFields(ctx, progress, outcome.record);
  if (submits.length) {
    ctx.hooks.onActivity?.({ phase: "submit", label: `Saving ${submits.length} records` });
  }
  await Promise.all(
    submits.map(async (outcome) => {
      try {
        outcome.accepted = await ctx.hooks.onRecord?.(outcome.record);
      } catch (error) {
        if (error instanceof IncompleteJobDataError || error?.name === "IncompleteJobDataError") {
          outcome.action = "invalid";
          outcome.issues = error.issues?.length ? error.issues : outcome.issues;
          return;
        }
        outcome.error = error;
      }
    }),
  );
  const failed = submits.find((outcome) => outcome.error);
  if (failed) throw failed.error;
}

function markDeltaOf(result) {
  if (result?.challenge) {
    return { marked: 0, notMarked: 0, reason: "", log: result.log || "" };
  }
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

  const skipPickedChallenge = async (job, pageUrl, pageIds, parsed) => {
    if (job?.challenge) {
      await handleBlock(await readPage(), pageUrl);
      await pause(PAGE_DELAY_MS);
      return true;
    }
    if (job) return false;
    if (parsed.isLastPage) {
      await store.clearCursor();
      throw new RoutineFinishedError("Nothing left to process on HiringCafe");
    }
    cursor = { ...advanceCursor(cursor, { nextPage: true }), lastPageIds: pageIds };
    await store.saveCursor(cursor);
    await pause(PAGE_DELAY_MS);
    // Lands on ?page=N for the next loop; if it does not, the loop opens that URL.
    await clickNextPage({
      call,
      readPage,
      rest,
      skipDelays,
      checkStopped: ctx.checkStopped,
      listUrl: cursor.lists[cursor.listIndex],
      pageIndex: cursor.page,
      onActivity: hooks.onActivity,
    });
    return true;
  };

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

  // Decide every job in page order. A job missing from `fetched` (challenge,
  // timeout) opens in the crawl tab, where the user can clear a challenge.
  const decideBatch = async (jobs, fetched, jobsOnPage, jobIndexOf) => {
    const outcomes = [];
    let leftList = false;
    for (const job of jobs) {
      ctx.checkStopped();
      const jobIndex = jobIndexOf(job.id);
      emitCursor({
        card: job.id,
        cardIndex: jobIndex,
        cardsOnPage: jobsOnPage,
        jobIndex,
        jobsOnPage,
      });
      if (job.markOnly) {
        outcomes.push({ job, action: "mark" });
        continue;
      }
      if (!job.url) {
        noteJobDecision(job.id, CARD_SKIP_NO_URL);
        outcomes.push({ job, action: "advance" });
        continue;
      }
      noteJobDecision(job.id, CARD_DECISION_OPENED, "open", "click");
      let detailPage = fetched.get(job.id);
      if (!detailPage) {
        leftList = true;
        const opened = await openVisible(job.url, "Opening job");
        if (await handleBlock(opened, job.url)) break;
        detailPage = await waitForDetailReady();
        if (await handleBlock(detailPage, job.url)) break;
      }
      const detail = parseDetail(detailPage.html, detailPage.url || job.url, {
        companyName: job.companyName,
        applyUrl: job.applyUrl,
        postedRaw: job.postedRaw,
        cardHref: job.url,
      });
      const detailId = detail.meta.id || job.id;
      if (isJobHandled({ id: detailId }, handledIds)) {
        noteJobDecision(job.id, CARD_SKIP_DETAIL_HANDLED);
        hooks.recordOutcome?.(SCRAPE_OUTCOMES.DUPLICATE);
        outcomes.push({ job, action: "handled", detailId });
        continue;
      }
      const record = jobRecord(detail);
      const ready = recordReadyToEnqueue(record);
      if (!ready.ok && ready.reason === "metadata-size") {
        noteJobDecision(job.id, CARD_SKIP_METADATA_SIZE);
        outcomes.push({ job, action: "advance" });
        continue;
      }
      if (ready.issues.length) {
        outcomes.push({ job, action: "invalid", issues: ready.issues });
        continue;
      }
      outcomes.push({ job, action: "submit", record, detailId, issues: ready.issues });
    }
    return { outcomes, leftList };
  };

  // Move the cursor job by job in page order, marking Applied as it goes.
  const settleBatch = async (outcomes, { canMark, jobsOnPage, jobIndexOf }) => {
    for (const outcome of outcomes) {
      ctx.checkStopped();
      const { job } = outcome;
      const jobIndex = jobIndexOf(job.id);
      if (outcome.action === "advance") {
        await advancePast(job.id);
        continue;
      }
      if (outcome.action === "invalid") {
        invalidStreak = nextInvalidStreak(invalidStreak);
        noteJobDecision(job.id, cardInvalidDecision(outcome.issues));
        await advancePast(job.id);
        continue;
      }
      if (outcome.action === "submit" && outcome.accepted !== true) {
        const { decision, reason } = ingestSkipOf(outcome.accepted);
        const log = notMarkedLog(job.id, reason);
        noteJobDecision(job.id, decision);
        hooks.onNotice?.(log, false);
        hooks.recordOutcome?.(SCRAPE_OUTCOMES.FAILED);
        emitCursor({
          card: job.id,
          cardIndex: jobIndex,
          cardsOnPage: jobsOnPage,
          jobIndex,
          jobsOnPage,
          markDelta: { marked: 0, notMarked: 1, reason, log },
        });
        await advancePast(job.id);
        continue;
      }
      if (outcome.action === "submit") invalidStreak = 0;
      if (outcome.action === "mark") {
        await advancePast(job.id);
      } else {
        await markJob(job.id);
        if (outcome.detailId && outcome.detailId !== job.id) await markJob(outcome.detailId);
      }
      if (!canMark) continue;
      hooks.onActivity?.({
        phase: "open",
        label: `Page ${displayPage(cursor.page)} · job ${jobIndex} of ${jobsOnPage}`,
        kind: "click",
      });
      await call("highlight", { selector: jobCardSelector(job) }).catch(() => {});
      const marked = await markAppliedOnCard({
        job,
        call,
        rest,
        skipDelays,
        onActivity: hooks.onActivity,
        onNotice: hooks.onNotice,
        readPage,
        enabled: markAppliedEnabled,
      });
      emitCursor({
        card: job.id,
        cardIndex: jobIndex,
        cardsOnPage: jobsOnPage,
        jobIndex,
        jobsOnPage,
        markDelta: markDeltaOf(marked),
      });
      if (marked.signedOut) throw new RoutineBlockedError(SIGN_IN_TO_MARK_MESSAGE);
    }
  };

  hooks.onActivity?.({ phase: "open", label: "Loading job list", kind: "waitFor" });
  await ensureMarkDebugger(call, markAppliedEnabled);
  const tab = await withRetry(() => readVisiblePage(call), START_PAGE_KEY);
  progress.tick();
  cursor = await ensureCursor(store, tab, {
    firstPass: Boolean(hooks.firstPass),
    onNotice: hooks.onNotice,
  });

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
      random: hooks.random ?? Math.random,
    });
    const pageIds = jobIdKey(parsed.jobs);
    warnIfPageEmpty(hooks, cursor.page, parsed.jobs.length);
    warnGroupShortfalls(hooks, parsed.shortfalls);
    await finishIfNothingLeft(store, parsed, pageIds, cursor.lastPageIds);

    const batch = await pickJobBatch({
      jobs: parsed.jobs,
      lastJobId: cursor.lastJobId,
      limit: DETAIL_TAB_BATCH,
      handledIds,
      noteJobDecision,
      recordOutcome: hooks.recordOutcome,
      // Applied cards found while picking count as handled; the cursor moves after the batch.
      markJob: async (jobId) => {
        handledIds = await store.markHandled(jobId, handledIds);
      },
      markAppliedEnabled,
      emitCursor,
      readApplied: (candidate) =>
        readAppliedOnCard({
          job: candidate,
          call,
          rest,
          skipDelays,
          readPage,
        }),
    });
    const firstPick = batch.challenge ? { challenge: true } : (batch.jobs[0] ?? null);
    if (await skipPickedChallenge(firstPick, pageUrl, pageIds, parsed)) continue;

    const jobsOnPage = parsed.jobs.length;
    const jobIndexOf = (jobId) => parsed.jobs.findIndex((item) => item.id === jobId) + 1;
    const fetched = await fetchHiringCafeDetails({
      call,
      rest,
      skipDelays,
      checkStopped: ctx.checkStopped,
      jobs: batch.jobs.filter((job) => !job.markOnly),
      onActivity: hooks.onActivity,
    });
    progress.tick();

    const { outcomes, leftList } = await decideBatch(batch.jobs, fetched, jobsOnPage, jobIndexOf);
    await submitBatch(ctx, progress, outcomes);
    // Mark Applied on the list once, card by card, moving the cursor in page order.
    let canMark = markAppliedEnabled && outcomes.some((outcome) => outcome.action !== "advance");
    if (canMark) {
      const listAfter = leftList
        ? await openVisible(pageUrl, "Returning to job list", "settle")
        : await readPage();
      if (await handleBlock(listAfter, pageUrl)) canMark = false;
      else throwIfSignedOut(listAfter.html, markAppliedEnabled);
    }
    await settleBatch(outcomes, { canMark, jobsOnPage, jobIndexOf });
    backoff.onSuccess();
    progress.tick();
    return;
  }
}
