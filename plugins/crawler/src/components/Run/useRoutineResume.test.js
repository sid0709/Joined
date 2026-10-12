import { describe, expect, test } from "bun:test";

import { START_FROM_PAGE_ONE_LABEL } from "../../routines/hiringcafe/constants.js";
import { createHiringCafeStore, memoryStorage } from "../../routines/hiringcafe/store.js";
import HiringCafeRoutine from "../../routines/HiringCafeRoutine.js";

describe("routine resume helpers", () => {
  test("HiringCafe exposes a Start from page 1 reset and resume label", async () => {
    const store = createHiringCafeStore(memoryStorage());
    expect(HiringCafeRoutine.resume.resetLabel).toBe(START_FROM_PAGE_ONE_LABEL);
    expect(await HiringCafeRoutine.resume.loadLabel(store)).toBe("");
    await store.saveCursor({
      listIndex: 0,
      page: 2,
      lastJobId: "reqaaa1111111111",
      lists: ["https://hiringcafe.com/classic"],
    });
    expect(await HiringCafeRoutine.resume.loadLabel(store)).toBe(
      "Resume from page 3 · reqaaa1111111111",
    );
    await HiringCafeRoutine.resume.reset(store);
    expect(await HiringCafeRoutine.resume.loadLabel(store)).toBe("");
  });
});
