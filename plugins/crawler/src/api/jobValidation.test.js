import { describe, expect, test } from "bun:test";

import BuiltInRoutine from "../routines/BuiltInRoutine.js";

import { assertCompleteJob, getJobValidationIssues, isJobFieldValid } from "./jobValidation.js";

function completeJob(overrides = {}) {
  return {
    applyUrl: "https://jobs.example/apply/1",
    title: "Engineer",
    description: "Build things.",
    companyName: "Acme",
    id: 1,
    duplicateWindowDays: 30,
    metadata: { location: "Remote" },
    ...overrides,
  };
}

describe("jobValidation", () => {
  test("requires only the core fields", () => {
    expect(getJobValidationIssues(completeJob())).toEqual([]);
    expect(getJobValidationIssues(completeJob({ salary: "" }), BuiltInRoutine)).toEqual([]);
    expect(assertCompleteJob(completeJob()).title).toBe("Engineer");
  });

  test("rejects a missing applyUrl or a bad optional URL", () => {
    expect(getJobValidationIssues(completeJob({ applyUrl: "" }))).toContain("Apply URL");
    expect(
      getJobValidationIssues(
        completeJob({ companyWebsite: "javascript:alert(1)" }),
        BuiltInRoutine,
      ),
    ).toContain("Website");
  });

  test("checks a declared field on the payload or its metadata", () => {
    expect(isJobFieldValid(completeJob(), "title", BuiltInRoutine)).toBe(true);
    expect(isJobFieldValid(completeJob({ applyUrl: "" }), "applyUrl", BuiltInRoutine)).toBe(false);
    expect(isJobFieldValid(completeJob(), "salary", BuiltInRoutine)).toBe(true);
    expect(isJobFieldValid(completeJob(), "id", BuiltInRoutine)).toBe(true);
  });
});
