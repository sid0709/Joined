import { describe, expect, test } from "bun:test";

import { appendNotice, definedEntries, mergePace } from "./paceState.js";

describe("mergePace", () => {
  test("keeps the last job cursor when a later emit omits jobIndex", () => {
    const afterFirst = mergePace(null, { page: 1, jobIndex: 1, jobsOnPage: 157, card: "req1" });
    expect(afterFirst).toMatchObject({ page: 1, jobIndex: 1, jobsOnPage: 157 });
    expect(mergePace(afterFirst, { page: 1, lastBlock: "challenge", card: "req1" })).toMatchObject({
      page: 1,
      jobIndex: 1,
      jobsOnPage: 157,
      lastBlock: "challenge",
    });
  });

  test("advances the cursor and keeps every not-marked job log", () => {
    const first = mergePace(null, {
      page: 1,
      jobIndex: 1,
      jobsOnPage: 157,
      markDelta: {
        marked: 0,
        notMarked: 1,
        reason: "hover missed overlay",
        log: "Job a not marked",
      },
    });
    const second = mergePace(first, {
      page: 1,
      jobIndex: 2,
      jobsOnPage: 157,
      markDelta: {
        marked: 0,
        notMarked: 1,
        reason: "hover missed overlay",
        log: "Job b not marked",
      },
    });
    expect(second.jobIndex).toBe(2);
    expect(second.notMarked).toBe(2);
    expect(second.markLogs).toEqual(["Job a not marked", "Job b not marked"]);
  });

  test("definedEntries drops undefined keys and appendNotice lists each line", () => {
    expect(definedEntries({ jobIndex: 3, jobsOnPage: undefined })).toEqual({ jobIndex: 3 });
    expect(appendNotice(null, "")).toBeNull();
    expect(appendNotice("", "Job a not marked")).toBe("Job a not marked");
    expect(appendNotice("Job a not marked", "Job a not marked")).toBe("Job a not marked");
    expect(appendNotice("Job a not marked", "Job b not marked")).toBe(
      "Job a not marked\nJob b not marked",
    );
  });
});
