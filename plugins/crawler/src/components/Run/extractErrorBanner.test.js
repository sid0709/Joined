import { describe, expect, test } from "bun:test";

import { EXTRACT_ERROR_TITLE, extractErrorBanner } from "./extractErrorBanner";

describe("extractErrorBanner", () => {
  test("hides the banner when there is no extract error", () => {
    expect(extractErrorBanner(null)).toBeNull();
    expect(extractErrorBanner(undefined)).toBeNull();
    expect(extractErrorBanner("")).toBeNull();
  });

  test("shows a warning banner with the extract error copy", () => {
    expect(extractErrorBanner("Card 9256204 skipped: extract failed (checker exploded)")).toEqual({
      status: "warning",
      title: EXTRACT_ERROR_TITLE,
      description: "Card 9256204 skipped: extract failed (checker exploded)",
    });
    expect(EXTRACT_ERROR_TITLE).toBe("Extraction error");
  });
});
