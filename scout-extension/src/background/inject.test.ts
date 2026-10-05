import { describe, expect, test } from "bun:test";

import { canInjectIntoUrl } from "./inject";

describe("canInjectIntoUrl", () => {
  test("allows http pages and missing urls", () => {
    expect(canInjectIntoUrl(undefined)).toBe(true);
    expect(canInjectIntoUrl("https://boards.greenhouse.io/acme/jobs/1")).toBe(true);
  });

  test("blocks restricted chrome pages", () => {
    expect(canInjectIntoUrl("chrome://extensions")).toBe(false);
    expect(canInjectIntoUrl("chrome-extension://abc/popup.html")).toBe(false);
    expect(canInjectIntoUrl("https://chromewebstore.google.com/detail/x")).toBe(false);
    expect(canInjectIntoUrl("https://chrome.google.com/webstore/detail/x")).toBe(false);
    expect(canInjectIntoUrl("https://chrome.google.com/webstore")).toBe(false);
    expect(canInjectIntoUrl("not a url")).toBe(false);
  });
});
