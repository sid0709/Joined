import { describe, expect, test } from "bun:test";

import {
  CARD_DECISION_OPENED,
  CARD_SKIP_HANDLED,
  CARD_SKIP_HEART_SAVED,
  CARD_SKIP_SAVED_BADGE,
  CARD_SKIP_NO_URL,
  CARD_SKIP_EXTRACT_FAILED,
  CURSOR_STORAGE_KEY,
  CURSOR_STORAGE_KEY_V1,
  HANDLED_MAX_AGE_MS,
  HANDLED_MAX_IDS,
  HANDLED_STORAGE_KEY,
  JOB_DELAY_MS,
  cardDecisionLabel,
  cardExtractFailedDecision,
  cardInvalidDecision,
  jitterMs,
  resumeCursorLabel,
  START_FROM_PAGE_1_HINT,
} from "./constants.js";
import {
  cssEscape,
  cssUnescape,
  entityIdFromSaveHost,
  jobCardSelector,
  jobSaveSelector,
} from "./cssEscape.js";
import {
  cardsAfterCursor,
  contiguousLastJobId,
  handledIdSet,
  isJobHandled,
  nextUnhandledCard,
} from "./handled.js";
import { createBuiltinStore, memoryStorage, pruneHandledRecord } from "./store.js";

describe("handled skip", () => {
  test("skips local IDs and a job-page isSaved flag, never a Saved span", () => {
    const handled = handledIdSet(["1", "2"]);
    expect(isJobHandled({ id: "1" }, handled)).toBe(true);
    expect(isJobHandled({ id: "3" }, handled)).toBe(false);
    expect(isJobHandled({ id: "3", isSaved: true }, handled)).toBe(true);
    expect(isJobHandled({ id: "3", hasSavedTag: true }, handled)).toBe(false);
    expect(isJobHandled({ id: "" }, handled)).toBe(false);
  });

  test("walks past the resume cursor and already-handled cards", () => {
    const cards = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const handled = handledIdSet(["b", "c"]);
    expect(cardsAfterCursor(cards, "a").map((card) => card.id)).toEqual(["b", "c", "d"]);
    expect(cardsAfterCursor(cards, "missing").map((card) => card.id)).toEqual(["a", "b", "c", "d"]);
    expect(nextUnhandledCard(cards, handled, "a")?.id).toBe("d");
    expect(nextUnhandledCard(cards, handledIdSet([]), "")?.id).toBe("a");
    expect(nextUnhandledCard(cards, handledIdSet(["a", "b", "c", "d"]), "")).toBeNull();
    expect(nextUnhandledCard(cards, handledIdSet([]), "missing")?.id).toBe("a");
    expect(nextUnhandledCard(cards, handledIdSet(["a", "b", "c"]), "missing")?.id).toBe("d");
    expect(contiguousLastJobId(cards, handledIdSet(["c", "d"]), "a")).toBe("a");
    expect(contiguousLastJobId(cards, handledIdSet(["c", "d"]), "")).toBe("");
    expect(contiguousLastJobId([{ id: "a" }, { id: "b" }], handledIdSet(["a", "b"]), "")).toBe("b");
  });

  test("names every card decision for the activity log", () => {
    expect(cardDecisionLabel("9256204", CARD_DECISION_OPENED)).toBe("Card 9256204 opened");
    expect(cardDecisionLabel("9256204", CARD_SKIP_HANDLED)).toBe(
      "Card 9256204 skipped: already handled",
    );
    expect(cardDecisionLabel("9256204", CARD_SKIP_HEART_SAVED)).toBe(
      "Card 9256204 skipped: list-card heart already saved",
    );
    expect(cardDecisionLabel("22222222", CARD_SKIP_SAVED_BADGE)).toBe(
      "Card 22222222 skipped: visible Saved badge",
    );
    expect(cardDecisionLabel("9256204", CARD_SKIP_NO_URL)).toBe("Card 9256204 skipped: no job URL");
    expect(cardDecisionLabel("11623103", cardInvalidDecision(["applyUrl", "companyName"]))).toBe(
      "Card 11623103 skipped: invalid applyUrl, companyName",
    );
    expect(cardExtractFailedDecision(new Error("checker exploded"))).toBe(
      `${CARD_SKIP_EXTRACT_FAILED} (checker exploded)`,
    );
    expect(START_FROM_PAGE_1_HINT).toMatch(/builtinCrawlCursorV2/);
  });

  test("escapes the Save control's entity id", () => {
    const evil = '9256204"][role="x';
    expect(jobCardSelector("9256204")).toBe(
      `div[data-id="job-card"]#${cssEscape("job-card-9256204")}`,
    );
    expect(jobSaveSelector("9256204")).toBe(
      `my-item[entity-type="job"][entity-id=${cssEscape("9256204")}]`,
    );
    expect(jobSaveSelector(evil)).toBe(`my-item[entity-type="job"][entity-id=${cssEscape(evil)}]`);
    expect(jobSaveSelector(evil)).not.toContain(`"${evil}"`);
    expect(cssEscape("\0")).toBe("\uFFFD");
    expect(cssUnescape(cssEscape("22222222"))).toBe("22222222");
    expect(entityIdFromSaveHost(jobSaveSelector("22222222"))).toBe("22222222");
  });

  test("persists handled IDs and the crawl cursor", async () => {
    const store = createBuiltinStore(memoryStorage());
    expect(await store.loadCursor()).toBeNull();
    expect([...(await store.loadHandledIds())]).toEqual([]);

    const handled = await store.markHandled("9256204", new Set());
    expect(handled.has("9256204")).toBe(true);
    expect([...(await store.loadHandledIds())]).toEqual(["9256204"]);

    await store.saveCursor({
      listIndex: 1,
      page: 4,
      lastJobId: "9256204",
      lists: ["https://builtin.com/jobs"],
    });
    expect(await store.loadCursor()).toEqual({
      listIndex: 1,
      page: 4,
      lastJobId: "9256204",
      lastPageIds: "",
      pageProcessed: 0,
      lists: ["https://builtin.com/jobs"],
    });
    await store.clearCursor();
    expect(await store.loadCursor()).toBeNull();
  });

  test("Start from page 1 writes a V2 page-1 cursor and drops V1", async () => {
    const storage = memoryStorage({
      [CURSOR_STORAGE_KEY_V1]: {
        listIndex: 0,
        page: 2,
        lastJobId: "old",
        lists: ["https://builtin.com/jobs"],
      },
      [CURSOR_STORAGE_KEY]: {
        listIndex: 0,
        page: 2,
        lastJobId: "11623491",
        lastPageIds: "",
        pageProcessed: 3,
        lists: ["https://builtin.com/jobs"],
        writtenBy: "2.4.5",
      },
    });
    const store = createBuiltinStore(storage);
    expect(resumeCursorLabel(await store.loadCursor())).toBe("Resume at page 2 · card 11623491");
    await store.resetToPage1();
    const cursor = await store.loadCursor();
    expect(resumeCursorLabel(cursor)).toBe("Start at page 1");
    expect(cursor).toMatchObject({ page: 1, lastJobId: "", pageProcessed: 0 });
    expect(storage.snapshot()[CURSOR_STORAGE_KEY_V1]).toBeNull();
  });

  test("ignores builtinCrawlCursorV1 and clears the stale key", async () => {
    const storage = memoryStorage({
      builtinCrawlCursorV1: {
        listIndex: 0,
        page: 35,
        lastJobId: "x",
        lists: ["https://builtin.com/jobs"],
      },
    });
    const store = createBuiltinStore(storage);
    expect(await store.loadCursor()).toBeNull();
    expect(storage.snapshot().builtinCrawlCursorV1).toBeNull();
    await store.clearHandled();
    expect(storage.snapshot()[HANDLED_STORAGE_KEY]).toEqual({});
  });

  test("drops handled IDs older than 90 days and keeps the newest 50k", () => {
    const now = 1_700_000_000_000;
    expect(pruneHandledRecord({ old: now - HANDLED_MAX_AGE_MS - 1, keep: now }, now)).toEqual({
      keep: now,
    });
    const raw = {};
    for (let i = 0; i < HANDLED_MAX_IDS + 1; i += 1) raw[String(i)] = now + i;
    const pruned = pruneHandledRecord(raw, now + HANDLED_MAX_IDS);
    expect(Object.keys(pruned)).toHaveLength(HANDLED_MAX_IDS);
    expect(pruned["0"]).toBeUndefined();
    expect(pruned[String(HANDLED_MAX_IDS)]).toBe(now + HANDLED_MAX_IDS);
  });

  test("prunes on load and preserves timestamps when marking a new id", async () => {
    const now = Date.now();
    const storage = memoryStorage({
      [HANDLED_STORAGE_KEY]: {
        old: 1,
        keep: now,
      },
    });
    const store = createBuiltinStore(storage);
    expect([...(await store.loadHandledIds())].sort()).toEqual(["keep"]);
    await store.markHandled("next", new Set(["keep"]), now + 1);
    expect(storage.snapshot()[HANDLED_STORAGE_KEY]).toEqual({ keep: now, next: now + 1 });
  });

  test("jitter stays inside the named delay range", () => {
    expect(jitterMs(JOB_DELAY_MS, () => 0)).toBe(JOB_DELAY_MS.min);
    expect(jitterMs(JOB_DELAY_MS, () => 1)).toBe(JOB_DELAY_MS.max);
  });

  test("ignores empty ids, non-numeric timestamps, and timestamp ties", () => {
    const now = 1_700_000_000_000;
    expect(pruneHandledRecord(["nope"], now)).toEqual({});
    expect(pruneHandledRecord({ "": now, bad: "x", a: now, b: now }, now)).toEqual({
      a: now,
      b: now,
    });
  });

  test("reads chrome-style storage and the memory get shapes", async () => {
    const data = {};
    const chromeStorage = {
      get(key, callback) {
        callback({ [key]: data[key] });
      },
      set(items, callback) {
        Object.assign(data, items);
        callback();
      },
    };
    const store = createBuiltinStore(chromeStorage);
    expect(await store.markHandled("", new Set(["keep"]))).toEqual(new Set(["keep"]));
    const now = Date.now();
    await store.markHandled("9", new Set(), now);
    expect([...(await store.loadHandledIds())]).toEqual(["9"]);

    const memory = memoryStorage({ a: 1, b: 2 });
    expect(memory.get(["a", "b"])).toEqual({ a: 1, b: 2 });
    expect(memory.get({ a: null, b: null })).toEqual({ a: 1, b: 2 });

    const empty = createBuiltinStore();
    expect([...(await empty.loadHandledIds())]).toEqual([]);
    await empty.saveCursor(null);
  });
});
