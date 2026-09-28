import { describe, expect, it } from "bun:test";

import { signIn, submitJob } from "./actions";
import { DEMO_EMAIL, DEMO_PASSWORD } from "./config";
import { seedState } from "./seed";

describe("submitJob", () => {
  it("rejects a job-board URL for a signed-in scout", () => {
    const signedIn = signIn(seedState(), DEMO_EMAIL, DEMO_PASSWORD);
    expect(signedIn.ok).toBe(true);
    const result = submitJob(signedIn.state, {
      url: "https://www.linkedin.com/jobs/view/123",
      companyName: "Acme",
      title: "Engineer",
      locationText: "Remote",
      salaryText: "",
      summary: "Own the matching pipeline for scouts, hunters, and bidders together.",
      tags: [],
      seniority: "mid",
    });
    expect(result.ok).toBe(true);
    expect(result.state.submissions[0]?.status).toBe("rejected");
    expect(result.state.submissions[0]?.rejectionReason).toBe("not an official source");
  });
});
