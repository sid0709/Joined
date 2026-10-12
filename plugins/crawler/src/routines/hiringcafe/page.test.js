import { describe, expect, test } from "bun:test";

import { RoutineStoppedError } from "../../routineKit/runner.js";

import {
  createOpenVisible,
  isAbortError,
  isTimeoutError,
  sameUrl,
  stripTrailingSlash,
} from "./page.js";

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

  test("treats a navigate timeout as success when the tab is already on the URL", async () => {
    const target = "https://hiringcafe.com/job/x-reqaaa1111111111";
    let reads = 0;
    const openVisible = createOpenVisible({
      withRetry: (fn) => fn(),
      call: async (op) => {
        if (op === "html") {
          reads += 1;
          if (reads === 1) return { html: "<html></html>", url: "https://hiringcafe.com/classic" };
          return { html: "<html>job</html>", url: target };
        }
        if (op === "navigate") throw new Error('Page op "navigate" timed out after 8000 ms');
        return {};
      },
    });
    await expect(openVisible(target, "Opening job")).resolves.toMatchObject({
      url: target,
      html: "<html>job</html>",
    });
  });
});
