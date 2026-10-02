import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sameApplyPage, sameApplySite } from "./apply-site.ts";

describe("sameApplyPage", () => {
  it("treats hash and tracking query as the same apply page", () => {
    assert.equal(
      sameApplyPage(
        "https://boards.greenhouse.io/acme/jobs/123#app",
        "https://boards.greenhouse.io/acme/jobs/123?utm_source=acorn",
      ),
      true,
    );
  });

  it("does not match a different job path on the same host", () => {
    assert.equal(
      sameApplyPage(
        "https://boards.greenhouse.io/acme/jobs/123",
        "https://boards.greenhouse.io/acme/jobs/456",
      ),
      false,
    );
  });
});

describe("sameApplySite", () => {
  it("matches sibling hosts on the same apply site", () => {
    assert.equal(
      sameApplySite(
        "https://job-boards.greenhouse.io/acme/jobs/123",
        "https://boards.greenhouse.io/acme/jobs/123",
      ),
      true,
    );
  });
});
