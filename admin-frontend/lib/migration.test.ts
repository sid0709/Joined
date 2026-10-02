import { expect, test } from "bun:test";

import {
  migrationCancelPath,
  migrationTaskPath,
  MIGRATION_TASKS,
  remaining,
  runEta,
  runTally,
  type MigrationRun,
} from "./migration";

const START = Date.parse("2026-10-02T10:00:00Z");

function run(overrides: Partial<MigrationRun>): MigrationRun {
  return {
    task: MIGRATION_TASKS.analyzeJobs,
    status: "running",
    total: 100,
    done: 0,
    skipped: 0,
    failed: 0,
    startedAt: new Date(START).toISOString(),
    failures: [],
    ...overrides,
  };
}

test("paths name the step", () => {
  expect(migrationTaskPath(MIGRATION_TASKS.copyJobs)).toBe("/v1/migration/jobs-copy");
  expect(migrationCancelPath(MIGRATION_TASKS.researchCompanies)).toBe(
    "/v1/migration/companies-research/cancel",
  );
});

test("the estimate follows the pace so far", () => {
  expect(runEta(run({ done: 50 }), START + 60_000)).toBe("1m left");
  expect(runEta(run({ done: 20, skipped: 5 }), START + 10_000)).toBe("30s left");
  expect(runEta(run({ done: 1 }), START + 120_000)).toBe("3h 18m left");
  expect(runEta(run({}), START + 60_000)).toBe("");
  expect(runEta(run({ done: 100, status: "succeeded" }), START + 60_000)).toBe("");
});

test("the tally only names skips and failures when there are some", () => {
  expect(runTally(run({ done: 1200, total: 5000 }))).toBe("1,200 of 5,000");
  expect(runTally(run({ done: 10, skipped: 3, failed: 2 }))).toBe(
    "15 of 100 · 3 skipped · 2 failed",
  );
});

test("remaining never goes below zero", () => {
  expect(remaining(10, 4)).toBe(6);
  expect(remaining(3, 7)).toBe(0);
});
