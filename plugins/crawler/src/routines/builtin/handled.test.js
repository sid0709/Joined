import { describe, expect, test } from "bun:test";

import { handledIdSet, isJobHandled, nextUnhandledCard } from "./handled.js";
import { createBuiltinStore, memoryStorage } from "./store.js";

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
      lists: ["https://builtin.com/jobs"],
    });
    await store.clearCursor();
    expect(await store.loadCursor()).toBeNull();
  });
});
