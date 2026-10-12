import { describe, expect, test } from "bun:test";

import { isJobDetailReady } from "./detailReady.js";
import "./testing/domParser.js";
import { loadFixture } from "./testing/loadFixture.js";

describe("isJobDetailReady", () => {
  test("needs jobPostInit, JSON-LD JobPosting, and an h1", () => {
    expect(isJobDetailReady("")).toBe(false);
    expect(isJobDetailReady("<html><body><h1>Loading</h1></body></html>")).toBe(false);
    expect(isJobDetailReady(loadFixture("detail-hpe.html"))).toBe(true);
    expect(isJobDetailReady(loadFixture("detail-easyapply.html"))).toBe(true);
  });
});
