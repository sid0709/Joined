import { describe, expect, test } from "bun:test";

import { RoutineStoppedError } from "../../routineKit/runner.js";

import { isAbortError, isTimeoutError, sameUrl, stripTrailingSlash } from "./page.js";

describe("HiringCafe page helpers", () => {
  test("compares tab URLs without a trailing slash", () => {
    expect(sameUrl("https://hiringcafe.com/classic", "https://hiringcafe.com/classic/")).toBe(true);
    expect(sameUrl("https://hiringcafe.com/classic", "https://hiringcafe.com/classic?page=1")).toBe(
      false,
    );
    expect(stripTrailingSlash("https://hiringcafe.com/classic/")).toBe(
      "https://hiringcafe.com/classic",
    );
    expect(stripTrailingSlash("not a url")).toBe("not a url");
  });

  test("classifies abort and timeout errors", () => {
    expect(isAbortError(new RoutineStoppedError())).toBe(true);
    expect(isAbortError({ name: "AbortError" })).toBe(true);
    expect(isAbortError(new Error("nope"))).toBe(false);
    expect(isTimeoutError(new Error('Page op "navigate" timed out after 15 ms'))).toBe(true);
    expect(isTimeoutError(new Error("blocked"))).toBe(false);
  });
});
