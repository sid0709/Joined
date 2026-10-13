import { describe, expect, test } from "bun:test";

import { SCRAPE_OUTCOMES } from "../../api/scrapeRunStats";

import { ingestAcceptFromOutcome, isIngestAccepted, isIngestRejected } from "./ingestAccept";

describe("ingestAcceptFromOutcome", () => {
  test("accepts registered and duplicate, rejects failed and validation", () => {
    expect(isIngestAccepted(SCRAPE_OUTCOMES.REGISTERED)).toBe(true);
    expect(isIngestAccepted(SCRAPE_OUTCOMES.DUPLICATE)).toBe(true);
    expect(isIngestRejected(SCRAPE_OUTCOMES.FAILED)).toBe(true);
    expect(isIngestRejected(SCRAPE_OUTCOMES.VALIDATION)).toBe(true);
    expect(ingestAcceptFromOutcome(SCRAPE_OUTCOMES.REGISTERED)).toBe(true);
    expect(ingestAcceptFromOutcome(SCRAPE_OUTCOMES.DUPLICATE)).toBe(true);
    expect(ingestAcceptFromOutcome(SCRAPE_OUTCOMES.FAILED)).toBe(false);
    expect(ingestAcceptFromOutcome(SCRAPE_OUTCOMES.VALIDATION)).toBe(false);
  });

  test("treats timeout and any other outcome as not accepted", () => {
    expect(ingestAcceptFromOutcome(null)).toBeNull();
    expect(ingestAcceptFromOutcome(undefined)).toBeNull();
    expect(ingestAcceptFromOutcome(SCRAPE_OUTCOMES.BLOCKED)).toBeNull();
    expect(ingestAcceptFromOutcome("queued")).toBeNull();
  });
});
