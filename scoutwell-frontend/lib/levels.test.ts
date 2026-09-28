import { describe, expect, it } from "bun:test";

import { LEVELS } from "./config";
import { canSubmitToday, levelMetrics, meetsPromotion, recomputeLevel } from "./levels";
import type { ScoutAccount, Submission } from "./types";

const account: ScoutAccount = {
  id: "s1",
  name: "Scout",
  email: "s@example.com",
  passwordText: "x",
  phone: "+1",
  emailVerified: true,
  phoneVerified: true,
  acceptedTermsAt: "2026-01-01T00:00:00.000Z",
  verificationTier: 1,
  taxInfoComplete: false,
  payoutMethod: null,
  level: "trusted",
  notifyDecisions: true,
  notifyRewards: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function job(patch: Partial<Submission> & Pick<Submission, "id" | "status">): Submission {
  return {
    scoutUserId: account.id,
    jobId: patch.id,
    url: "https://acme.com/jobs/1",
    canonicalUrl: "https://acme.com/jobs/1",
    companyName: "Acme",
    title: "Engineer",
    locationText: "Remote",
    salaryText: "",
    summary: "A role.",
    tags: [],
    seniority: "mid",
    rejectionReason: "",
    autoCheckResults: [],
    hiddenJob: true,
    alreadyOnMajorBoards: false,
    applications: 0,
    interviews: 0,
    hires: 0,
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    expired: false,
    ...patch,
  };
}

describe("levels", () => {
  it("counts remaining submissions against the daily cap", () => {
    const mine = Array.from({ length: 3 }, (_, index) =>
      job({ id: `j${index}`, status: "approved" }),
    );
    const metrics = levelMetrics(account, mine);
    expect(metrics.submittedToday).toBe(3);
    expect(metrics.remainingToday).toBe(LEVELS.trusted.dailyLimit - 3);
    expect(canSubmitToday(account, mine)).toBe(true);
  });

  it("promotes trusted scouts who hit quality bars", () => {
    const mine = Array.from({ length: 30 }, (_, index) =>
      job({
        id: `j${index}`,
        status: "approved",
        interviews: 1,
        canonicalUrl: `https://acme.com/jobs/${index}`,
      }),
    );
    const metrics = levelMetrics(account, mine);
    expect(meetsPromotion(metrics)).toBe(true);
    expect(recomputeLevel("trusted", metrics)).toBe("expert");
  });
});
