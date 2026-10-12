import { describe, expect, test } from "bun:test";

import { HANDLED_MAX_AGE_MS, HANDLED_MAX_IDS, HANDLED_STORAGE_KEY } from "./constants.js";
import { cssEscape, jobSaveSelector } from "./cssEscape.js";
import { handledIdSet, isJobHandled, nextUnhandledCard } from "./handled.js";
import { createBuiltinStore, memoryStorage, pruneHandledRecord } from "./store.js";

describe("handled skip", () => {
  test("skips local IDs, isSaved, and a visible Saved tag", () => {
    const handled = handledIdSet(["1", "2"]);
    expect(isJobHandled({ id: "1" }, handled)).toBe(true);
    expect(isJobHandled({ id: "3" }, handled)).toBe(false);
    expect(isJobHandled({ id: "3", isSaved: true }, handled)).toBe(true);
    expect(isJobHandled({ id: "3", hasSavedTag: true }, handled)).toBe(true);
    expect(isJobHandled({ id: "" }, handled)).toBe(false);
  });

  test("walks past the resume cursor and already-handled cards", () => {
    const cards = [{ id: "a" }, { id: "b", hasSavedTag: true }, { id: "c" }, { id: "d" }];
    const handled = handledIdSet(["c"]);
    expect(nextUnhandledCard(cards, handled, "a")?.id).toBe("d");
    expect(nextUnhandledCard(cards, handledIdSet([]), "")?.id).toBe("a");
    expect(nextUnhandledCard(cards, handledIdSet(["a", "c", "d"]), "")).toBeNull();
    expect(nextUnhandledCard(cards, handledIdSet([]), "missing")?.id).toBe("a");
    expect(nextUnhandledCard(cards, handledIdSet(["a", "c"]), "missing")?.id).toBe("d");
  });

  test("escapes the Save control's entity id", () => {
    const evil = '9256204"][role="x';
    expect(jobSaveSelector("9256204")).toBe(
      `my-item[entity-type="job"][entity-id=${cssEscape("9256204")}]`,
    );
    expect(jobSaveSelector(evil)).toBe(`my-item[entity-type="job"][entity-id=${cssEscape(evil)}]`);
    expect(jobSaveSelector(evil)).not.toContain(`"${evil}"`);
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
      lists: ["https://builtin.com/jobs"],
    });
    await store.clearCursor();
    expect(await store.loadCursor()).toBeNull();
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
});
