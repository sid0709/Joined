import { describe, expect, test } from "bun:test";

import { CURSOR_STORAGE_KEY } from "../../routines/builtin/constants.js";
import { createBuiltinStore, memoryStorage } from "../../routines/builtin/store.js";

import { resetCursorAndStart } from "./BuiltinResume.jsx";

describe("BuiltinResume", () => {
  test("Start from page 1 resets the cursor and starts the run", async () => {
    const storage = memoryStorage({
      [CURSOR_STORAGE_KEY]: {
        listIndex: 0,
        page: 3,
        lastJobId: "9256204",
        lists: ["https://builtin.com/jobs?country=USA"],
        startUrl: "https://builtin.com/jobs?country=USA",
        writtenBy: "2.5.8",
      },
    });
    const store = createBuiltinStore(storage);
    const starts = [];
    await resetCursorAndStart(store, () => {
      starts.push("start");
    });
    expect(starts).toEqual(["start"]);
    expect(await store.loadCursor()).toMatchObject({
      page: 1,
      lastJobId: "",
      startUrl: "https://builtin.com/jobs?country=USA",
    });
  });
});
