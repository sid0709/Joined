import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readStoredJobDescription } from "./job-description.ts";

describe("readStoredJobDescription", () => {
  it("prefers the stored jobDescription field on a list item", () => {
    assert.equal(
      readStoredJobDescription({
        id: "job-1",
        description: "short blurb",
        jobDescription: "Full posting for Staff Engineer",
      }),
      "Full posting for Staff Engineer",
    );
  });

  it("reads nested analysis.jobDescription when the top-level field is empty", () => {
    assert.equal(
      readStoredJobDescription({
        analysis: { jobDescription: "Nested posting" },
      }),
      "Nested posting",
    );
  });

  it("returns null when no JD is stored", () => {
    assert.equal(readStoredJobDescription({ id: "job-1", title: "Role" }), null);
    assert.equal(readStoredJobDescription(null), null);
  });
});
