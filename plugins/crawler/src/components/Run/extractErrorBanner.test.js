import { describe, expect, test } from "bun:test";

import { NOT_MARKED_REASON } from "../../routines/hiringcafe/constants";

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

  test("titles a not-marked reason as Mark Applied", () => {
    expect(
      extractErrorBanner("Job reqaaa1111111111 not marked applied: hover missed overlay"),
    ).toEqual({
      status: "warning",
      title: "Mark Applied",
      description: "Job reqaaa1111111111 not marked applied: hover missed overlay",
    });
  });

  test("lists every not-marked job log on the errors banner", () => {
    const logs = [
      "Job reqaaa1111111111 not marked applied: hover missed overlay",
      "Job reqbbb2222222222 not marked applied: hover missed overlay",
    ];
    expect(extractErrorBanner(logs.join("\n"), [], logs)).toEqual({
      status: "warning",
      title: "Mark Applied",
      description: logs.join(" · "),
    });
    const reasons = Object.values(NOT_MARKED_REASON);
    expect(extractErrorBanner("", reasons).description).toBe(reasons.join(" · "));
  });

  test("does not put Job marked applied success lines on the extraction banner", () => {
    expect(extractErrorBanner(null, [], ["Job reqaaa1111111111 marked applied"])).toBeNull();
    expect(
      extractErrorBanner(
        "Job reqaaa1111111111 marked applied",
        [],
        [
          "Job reqaaa1111111111 marked applied",
          "Job reqbbb2222222222 not marked applied: hover missed overlay",
        ],
      ),
    ).toEqual({
      status: "warning",
      title: "Mark Applied",
      description: "Job reqbbb2222222222 not marked applied: hover missed overlay",
    });
  });
});
