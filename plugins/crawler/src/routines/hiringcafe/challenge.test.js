import { describe, expect, test } from "bun:test";

import { detectHiringCafeBlock, isHiringCafeChallenge } from "./challenge.js";

describe("HiringCafe challenge detection", () => {
  test("treats Turnstile and verify-you-are-human pages as a challenge", () => {
    expect(
      isHiringCafeChallenge({
        status: 200,
        html: "<html>Performing security verification. Verify you are human.</html>",
      }),
    ).toBe(true);
    expect(
      isHiringCafeChallenge({
        status: 403,
        html: "<div class='cf-turnstile'></div>Just a moment...",
      }),
    ).toBe(true);
    expect(isHiringCafeChallenge({ status: 200, html: "<html>job cards</html>" })).toBe(false);
    expect(detectHiringCafeBlock({ status: 429, html: "" })).toEqual({
      blocked: true,
      kind: "429",
    });
    expect(detectHiringCafeBlock({ status: 200, html: "access denied" }).kind).toBe("challenge");
  });
});
