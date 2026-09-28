import { expect, test } from "bun:test";

import { attentionChecks, flagSummary, queueFilter, queueQuery } from "./scouting";

const check = (id: string, outcome: "pass" | "fail" | "review" | "flag") => ({
  id,
  label: id,
  outcome,
  detail: "",
});

test("queue filter defaults to needs review", () => {
  expect(queueFilter(null)).toBe("needs_review");
  expect(queueFilter("approved")).toBe("approved");
  expect(queueFilter("")).toBe("");
  expect(queueFilter("all")).toBe("");
  expect(queueFilter("bogus")).toBe("needs_review");
});

test("attention checks order failures first and drop passes", () => {
  const checks = [check("a", "flag"), check("b", "pass"), check("c", "fail"), check("d", "review")];
  expect(attentionChecks(checks).map((item) => item.id)).toEqual(["c", "d", "a"]);
  expect(flagSummary({ auto_check_results: checks })).toBe("c · d · a");
  expect(flagSummary({ auto_check_results: [check("x", "pass")] })).toBe("All checks passed");
});

test("queue query leaves defaults out", () => {
  expect(queueQuery({ status: "needs_review", q: "", channel: "", page: 1 })).toBe("");
  expect(queueQuery({ status: "", q: "acme", channel: "api", page: 2 })).toBe(
    "?status=all&q=acme&channel=api&page=2",
  );
});
