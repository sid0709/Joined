import { describe, expect, test } from "bun:test";

import {
  CARD_DECISION_OPENED,
  CARD_SKIP_HANDLED,
  HANDLED_MAX_AGE_MS,
  HANDLED_MAX_IDS,
  HANDLED_STORAGE_KEY,
  JOB_DELAY_MS,
  MARK_APPLIED_ENABLED,
  START_FROM_PAGE_ONE_LABEL,
  cardDecisionLabel,
  cardInvalidDecision,
  jitterMs,
  resumeLabelFromCursor,
  stuckPageMessage,
} from "./constants.js";
import { handledIdSet, isJobHandled, jobsAfterCursor, nextUnhandledJob } from "./handled.js";
import { isMarkAppliedEnabled } from "./markApplied.js";
import { createHiringCafeStore, memoryStorage, pruneHandledRecord } from "./store.js";

const LIST_URL = "https://hiringcafe.com/classic";

describe("handled skip", () => {
  test("tracks jobs by requisition_id and walks past the resume cursor", () => {
    const handled = handledIdSet(["reqaaa1111111111", "reqbbb2222222222"]);
    expect(isJobHandled({ id: "reqaaa1111111111" }, handled)).toBe(true);
    expect(isJobHandled({ id: "reqccc3333333333" }, handled)).toBe(false);
    expect(isJobHandled({ id: "" }, handled)).toBe(false);
    const jobs = [
      { id: "reqaaa1111111111" },
      { id: "reqbbb2222222222" },
      { id: "reqccc3333333333" },
      { id: "reqddd4444444444" },
    ];
    expect(jobsAfterCursor(jobs, "reqaaa1111111111").map((job) => job.id)).toEqual([
      "reqbbb2222222222",
      "reqccc3333333333",
      "reqddd4444444444",
    ]);
    expect(nextUnhandledJob(jobs, handled, "reqaaa1111111111")?.id).toBe("reqccc3333333333");
    expect(cardDecisionLabel("reqaaa1111111111", CARD_DECISION_OPENED)).toBe(
      "Job reqaaa1111111111 opened",
    );
    expect(cardDecisionLabel("reqaaa1111111111", CARD_SKIP_HANDLED)).toBe(
      "Job reqaaa1111111111 skipped: already handled",
    );
    expect(cardInvalidDecision(["applyUrl", "description"])).toBe("invalid applyUrl, description");
    expect(stuckPageMessage(3)).toBe("The same HiringCafe page failed 3 times. Crawl stopped.");
  });

  test("persists handled IDs and a 0-indexed crawl cursor", async () => {
    const store = createHiringCafeStore(memoryStorage());
    expect(await store.loadCursor()).toBeNull();
    expect([...(await store.loadHandledIds())]).toEqual([]);

    const handled = await store.markHandled("reqaaa1111111111", new Set());
    expect(handled.has("reqaaa1111111111")).toBe(true);
    expect([...(await store.loadHandledIds())]).toEqual(["reqaaa1111111111"]);

    await store.saveCursor({
      listIndex: 0,
      page: 4,
      lastJobId: "reqaaa1111111111",
      lists: [LIST_URL],
    });
    expect(await store.loadCursor()).toEqual({
      listIndex: 0,
      page: 4,
      lastJobId: "reqaaa1111111111",
      lastPageIds: "",
      lists: [LIST_URL],
    });
    expect(resumeLabelFromCursor(await store.loadCursor())).toBe(
      "Resume from page 5 · reqaaa1111111111",
    );
    await store.clearCursor();
    expect(await store.loadCursor()).toBeNull();
    expect(START_FROM_PAGE_ONE_LABEL).toBe("Start from page 1");
  });

  test("keeps Mark Applied on by default for a signed-in session", () => {
    expect(MARK_APPLIED_ENABLED).toBe(true);
    expect(isMarkAppliedEnabled()).toBe(true);
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
  });

  test("jitter stays inside the named delay range", () => {
    expect(jitterMs(JOB_DELAY_MS, () => 0)).toBe(JOB_DELAY_MS.min);
    expect(jitterMs(JOB_DELAY_MS, () => 1)).toBe(JOB_DELAY_MS.max);
  });

  test("prunes on load and reads chrome-style storage", async () => {
    const now = Date.now();
    const storage = memoryStorage({
      [HANDLED_STORAGE_KEY]: { old: 1, keep: now },
    });
    const store = createHiringCafeStore(storage);
    expect([...(await store.loadHandledIds())].sort()).toEqual(["keep"]);

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
    const chromeStore = createHiringCafeStore(chromeStorage);
    await chromeStore.markHandled("reqaaa1111111111", new Set(), now);
    expect([...(await chromeStore.loadHandledIds())]).toEqual(["reqaaa1111111111"]);
  });
});
