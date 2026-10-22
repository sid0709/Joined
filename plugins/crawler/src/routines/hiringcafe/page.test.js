import { describe, expect, test } from "bun:test";

import { RoutineStoppedError } from "../../routineKit/runner.js";

import { STUCK_PAGE_FAILURES } from "./constants.js";
import {
  createOpenVisible,
  createWithRetry,
  isAbortError,
  isTimeoutError,
  isTransientPageError,
  sameUrl,
  stripTrailingSlash,
  waitForChallengeClear,
} from "./page.js";

const CHALLENGE_HTML =
  "<html><head><title>Just a moment...</title></head><body><div class='cf-turnstile'></div></body></html>";
const RELOADING = "Could not establish connection. Receiving end does not exist.";
const ctx = { checkStopped: () => {} };

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

  test("classifies the errors a reloading page or a Cloudflare check throws", () => {
    expect(isTransientPageError(new Error(RELOADING))).toBe(true);
    expect(isTransientPageError(new Error("The page did not return HTML"))).toBe(true);
    expect(isTransientPageError(new Error("blocked"))).toBe(false);
  });

  test("waits through any number of reload errors without counting them toward a stop", async () => {
    const failures = [];
    let attempts = 0;
    const withRetry = createWithRetry({
      ctx,
      skipDelays: true,
      rest: async () => {},
      notePageFailure: (url) => failures.push(url),
    });
    const result = await withRetry(async () => {
      attempts += 1;
      if (attempts <= STUCK_PAGE_FAILURES + 2) throw new Error(RELOADING);
      return "loaded";
    }, "https://hiringcafe.com/classic");
    expect(result).toBe("loaded");
    expect(failures).toEqual([]);
  });

  test("waits for the user to clear the Cloudflare check, through its reloads", async () => {
    const reads = [
      { html: CHALLENGE_HTML, url: "https://hiringcafe.com/classic?__cf_chl_rt_tk=x" },
      new Error(RELOADING),
      { html: CHALLENGE_HTML, url: "https://hiringcafe.com/classic?__cf_chl_rt_tk=x" },
      { html: "<html><body>jobs</body></html>", url: "https://hiringcafe.com/classic" },
    ];
    const notices = [];
    let rests = 0;
    const page = await waitForChallengeClear({
      ctx,
      call: async () => {
        const next = reads.shift();
        if (next instanceof Error) throw next;
        return next;
      },
      rest: async () => {
        rests += 1;
      },
      skipDelays: false,
      onNotice: (message) => notices.push(message),
    });
    expect(page.html).toContain("jobs");
    expect(rests).toBe(3);
    expect(notices).toHaveLength(1);
  });

  test("hands a navigate that lands on a Cloudflare check to the challenge wait", async () => {
    const target = "https://hiringcafe.com/classic?page=1";
    let reads = 0;
    const openVisible = createOpenVisible({
      withRetry: (fn) => fn(),
      call: async (op) => {
        if (op === "html") {
          reads += 1;
          if (reads === 1) return { html: "<html></html>", url: "https://hiringcafe.com/classic" };
          return { html: CHALLENGE_HTML, url: `${target}&__cf_chl_rt_tk=abc`, status: 403 };
        }
        if (op === "navigate") throw new Error('Page op "navigate" timed out after 8000 ms');
        return {};
      },
    });
    await expect(openVisible(target, "Opening page")).resolves.toMatchObject({
      html: CHALLENGE_HTML,
    });
  });
});
