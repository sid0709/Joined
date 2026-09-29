import { expect, test } from "bun:test";

import { isPending, options, SENIORITY_LABEL, SUBMISSION_STATUS } from "./labels";

test("every submission status has a label and badge", () => {
  for (const meta of Object.values(SUBMISSION_STATUS)) {
    expect(meta.label.length).toBeGreaterThan(0);
    expect(meta.badge.length).toBeGreaterThan(0);
  }
});

test("only submitted and checking are pending", () => {
  expect(isPending("auto_checking")).toBe(true);
  expect(isPending("needs_review")).toBe(false);
});

test("options keeps the API order", () => {
  expect(options(["Leader", "Junior"] as const, SENIORITY_LABEL)).toEqual([
    { value: "Leader", label: "Lead" },
    { value: "Junior", label: "Junior" },
  ]);
});
