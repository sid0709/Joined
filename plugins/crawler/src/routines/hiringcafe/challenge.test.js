import { describe, expect, test } from "bun:test";

import { detectHiringCafeBlock, isHiringCafeChallenge } from "./challenge.js";
import "./testing/domParser.js";

describe("HiringCafe challenge detection", () => {
  test("treats a visible Turnstile widget or challenge title as a challenge", () => {
    expect(
      isHiringCafeChallenge({
        status: 200,
        html: "<html><head><title>Just a moment...</title></head><body></body></html>",
      }),
    ).toBe(true);
    expect(
      isHiringCafeChallenge({
        status: 403,
        html: "<html><body><div class='cf-turnstile'></div></body></html>",
      }),
    ).toBe(true);
    expect(isHiringCafeChallenge({ status: 200, html: "<html>job cards</html>" })).toBe(false);
    expect(detectHiringCafeBlock({ status: 429, html: "" })).toEqual({
      blocked: true,
      kind: "429",
    });
    expect(detectHiringCafeBlock({ status: 403, html: "access denied" })).toEqual({
      blocked: true,
      kind: "403",
    });
    expect(detectHiringCafeBlock({ status: 404, url: "https://hiringcafe.com/classic" })).toEqual({
      blocked: true,
      kind: "dead",
    });
  });

  test("ignores Cloudflare challenge-platform scripts on a normal page", () => {
    const html = `<html><head><title>HiringCafe</title></head><body>
      <script src="https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1"></script>
      <div data-testid="job-results">jobs</div>
    </body></html>`;
    expect(isHiringCafeChallenge({ status: 200, html })).toBe(false);
    expect(detectHiringCafeBlock({ status: 200, html: "access denied" })).toEqual({
      blocked: false,
      kind: "",
    });
    expect(
      isHiringCafeChallenge({
        status: 200,
        html: `<html><body><div class="cf-turnstile" style="display:none"></div></body></html>`,
      }),
    ).toBe(false);
  });
});
