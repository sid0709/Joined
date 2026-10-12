import { reportDeclaredFields } from "../../routineKit/declaredFields.js";
import { RoutineFinishedError, RoutineStepError } from "../../routineKit/runner.js";

import { JOB_DELAY_MS, MAX_PAGE, PAGE_DELAY_MS, jitterMs } from "./constants.js";
import { jobSaveSelector } from "./cssEscape.js";
import { isJobHandled, nextUnhandledCard } from "./handled.js";
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

async function currentPage(call) {
  const result = await call("html");
  if (!result?.html) throw new RoutineStepError("The page did not return HTML");
  return { html: result.html, url: result.url || "" };
}

async function fetchPage(call, url) {
  const result = await call("fetch", { url });
  if (!result?.html) throw new RoutineStepError(`Failed to fetch ${url}`);
  return { html: result.html, url: result.url || url };
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

async function loadListPage(call, tab, listUrl) {
  if (tab?.url && stripTrailingSlash(tab.url) === stripTrailingSlash(listUrl)) return tab;
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

async function markJob(store, handledIds, cursor, jobId) {
  const nextHandled = await store.markHandled(jobId, handledIds);
  await store.saveCursor({ ...cursor, lastJobId: String(jobId) });
  return nextHandled;
}

async function maybeClickSave(call, detail) {
  if (!detail.meta.isLoggedIn || detail.meta.isSaved || !detail.meta.id) return;
  await call("click", {
    selector: jobSaveSelector(detail.meta.id),
    wait: 0,
  });
}

async function readFields(ctx, progress, record) {
  await reportDeclaredFields(ctx, progress, record);
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

/**
 * One pass: skip already-handled cards, fetch the next job's HTML, enqueue it,
 * persist the cursor, and honour Stop via ctx.rest / checkStopped.
 */
export async function runBuiltInPass(ctx, progress) {
  const { hooks, call, rest } = ctx;
  const store = hooks.store ?? createBuiltinStore();
  const pause = async (range) => {
    if (hooks.skipDelays) return;
    await rest(jitterMs(range, hooks.random));
  };

  hooks.onActivity?.({ phase: "open", label: "Loading job list", kind: "waitFor" });
  const tab = await currentPage(call);
  progress.tick();

  let handledIds = await store.loadHandledIds();
  let cursor = await ensureCursor(store, tab);
  const maxSteps = MAX_PAGE * Math.max(cursor.lists.length, 1) + 1;
  let steps = 0;

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
    const listPage = await loadListPage(call, tab, listUrlForPage(listUrl, cursor.page));
    const parsed = parseList(listPage.html, listPage.url);
    const pageIds = cardIdKey(parsed.cards);
    if (pageIds && pageIds === cursor.lastPageIds) {
      cursor = advanceCursor(cursor, { nextList: true });
      await store.saveCursor(cursor);
      await pause(PAGE_DELAY_MS);
      continue;
    }
    const card = nextUnhandledCard(parsed.cards, handledIds, cursor.lastJobId);

    if (!card) {
      cursor = nextCursorAfterPage(cursor, parsed);
      await store.saveCursor(cursor);
      await pause(PAGE_DELAY_MS);
      continue;
    }

    if (!card.url) {
      handledIds = await markJob(store, handledIds, cursor, card.id);
      continue;
    }

    hooks.onActivity?.({ phase: "ready", label: "Opening job", kind: "waitFor" });
    await pause(JOB_DELAY_MS);
    const detailPage = await fetchPage(call, card.url);
    progress.tick();

    const detail = parseDetail(detailPage.html, detailPage.url || card.url);
    const jobId = card.id;
    const detailId = detail.meta.id || card.id;
    if (isJobHandled({ id: detailId, isSaved: detail.meta.isSaved }, handledIds)) {
      handledIds = await markJob(store, handledIds, cursor, jobId);
      continue;
    }

    const record = jobRecord(detail);
    await readFields(ctx, progress, record);
    hooks.onActivity?.({ phase: "submit", label: "Saving record" });
    try {
      await hooks.onRecord?.(record);
    } catch (error) {
      await store.saveCursor({ ...cursor, lastJobId: String(jobId) });
      throw error;
    }
    handledIds = await markJob(store, handledIds, cursor, jobId);
    if (detailId !== jobId) handledIds = await markJob(store, handledIds, cursor, detailId);
    hooks.onActivity?.({ phase: "dismiss", label: "Marking job handled", kind: "click" });
    await maybeClickSave(call, detail);
    progress.tick();
    hooks.onActivity?.({ phase: "settle", label: "Waiting before the next job", kind: "pause" });
    progress.tick();
    return;
  }
}
