import { describe, expect, test } from "bun:test";

import { resumeCursorLabel } from "./constants.js";
import { advanceCursor, canAdvanceBuiltinPage, emptyCursor } from "./lists.js";

describe("builtin lists cursor", () => {
  test("empty and advanced cursors reset pageProcessed", () => {
    const cursor = emptyCursor(["https://builtin.com/jobs"]);
    expect(cursor).toEqual({
      listIndex: 0,
      page: 1,
      lastJobId: "",
      lastPageIds: "",
      pageProcessed: 0,
      lists: ["https://builtin.com/jobs"],
    });
    expect(
      advanceCursor({ ...cursor, pageProcessed: 3, lastJobId: "1" }, { nextPage: true }),
    ).toEqual({
      ...cursor,
      page: 2,
      lastJobId: "",
      pageProcessed: 0,
    });
  });

  test("advances a page only after processed cards or a fully handled page", () => {
    expect(canAdvanceBuiltinPage({ cardCount: 0, pageProcessed: 2 })).toBe(false);
    expect(canAdvanceBuiltinPage({ cardCount: 4, pageProcessed: 0 })).toBe(false);
    expect(canAdvanceBuiltinPage({ cardCount: 4, pageProcessed: 1 })).toBe(true);
    expect(canAdvanceBuiltinPage({ cardCount: 4, pageProcessed: 0, allHandled: true })).toBe(true);
  });

  test("names the resume position", () => {
    expect(resumeCursorLabel(null)).toBe("Start at page 1");
    expect(resumeCursorLabel({ page: 1 })).toBe("Start at page 1");
    expect(resumeCursorLabel({ page: 35 })).toBe("Resume at page 35");
    expect(resumeCursorLabel({ page: 35, lastJobId: "9256204" })).toBe(
      "Resume at page 35 · card 9256204",
    );
  });
});
