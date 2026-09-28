import { describe, expect, it } from "bun:test";

import { evaluateSubmission } from "./pipeline";

const trusted = { level: "trusted" as const };
const probation = { level: "probation" as const };

describe("submission pipeline", () => {
  it("rejects job-board URLs automatically", () => {
    const decision = evaluateSubmission(
      {
        url: "https://linkedin.com/jobs/view/123",
        companyName: "Acme",
        title: "Engineer",
        summary: "Own the product design system for a growing team in Chicago.",
      },
      trusted,
      [],
    );
    expect(decision.status).toBe("rejected");
    expect(decision.rejectionReason).toBe("not an official source");
  });

  it("keeps probation submissions in review even when checks pass", () => {
    const decision = evaluateSubmission(
      {
        url: "https://boards.greenhouse.io/acme/jobs/9",
        companyName: "Acme",
        title: "Engineer",
        summary: "Own the product design system for a growing team in Chicago.",
      },
      probation,
      [],
    );
    expect(decision.status).toBe("needs_review");
  });

  it("auto-approves a clean trusted submission as a hidden job", () => {
    const decision = evaluateSubmission(
      {
        url: "https://jobs.ashbyhq.com/northwind/123",
        companyName: "Northwind",
        title: "Staff Engineer",
        summary: "Lead platform work on billing and matching for a hiring product.",
      },
      trusted,
      [],
    );
    expect(decision.status).toBe("approved");
    expect(decision.hiddenJob).toBe(true);
  });
});
