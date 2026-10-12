import { describe, expect, test } from "bun:test";

import { isJobDetailReady } from "./detailReady.js";
import { detailPageHtml } from "./testing/pageHtml.js";
import "./testing/domParser.js";

describe("isJobDetailReady", () => {
  test("requires __NEXT_DATA__ job and an h1", () => {
    expect(isJobDetailReady(detailPageHtml())).toBe(true);
    expect(isJobDetailReady("<html><body><h1>Loading</h1></body></html>")).toBe(false);
    expect(isJobDetailReady("")).toBe(false);
  });
});
