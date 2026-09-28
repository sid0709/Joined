import { describe, expect, it } from "bun:test";

import { MIN_PAYOUT_CENTS } from "./config";
import {
  approvalRewardCents,
  availablePayoutCents,
  canRequestPayout,
  conversionRewardCents,
  interviewRewardCents,
} from "./rewards";
import type { Earning, ScoutAccount } from "./types";

const account: ScoutAccount = {
  id: "s1",
  name: "Scout",
  email: "s@example.com",
  passwordText: "x",
  phone: "+1",
  emailVerified: true,
  phoneVerified: true,
  acceptedTermsAt: "2026-01-01T00:00:00.000Z",
  verificationTier: 2,
  taxInfoComplete: true,
  payoutMethod: { type: "stripe", last4: "4242" },
  level: "expert",
  notifyDecisions: true,
  notifyRewards: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("rewards", () => {
  it("pays no approval credit on probation", () => {
    expect(approvalRewardCents("probation", false)).toBe(0);
  });

  it("discounts jobs already on major boards", () => {
    expect(approvalRewardCents("trusted", true)).toBe(75);
    expect(approvalRewardCents("trusted", false)).toBe(150);
  });

  it("applies the expert interview multiplier", () => {
    expect(interviewRewardCents("expert", "senior")).toBe(1875);
  });

  it("takes a share of company interview fees on conversion", () => {
    expect(conversionRewardCents(30_00 * 10)).toBe(3000);
  });

  it("blocks payouts below the minimum or without verification", () => {
    const earnings: Earning[] = [
      {
        id: "e1",
        scoutUserId: account.id,
        submissionId: null,
        type: "interview",
        amountCents: MIN_PAYOUT_CENTS,
        currency: "USD",
        status: "released",
        holdUntil: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        releasedAt: "2026-01-15T00:00:00.000Z",
        paidAt: null,
        description: "Interview",
      },
    ];
    expect(availablePayoutCents(earnings)).toBe(MIN_PAYOUT_CENTS);
    expect(canRequestPayout(account, earnings)).toBe(true);
    expect(canRequestPayout({ ...account, verificationTier: 1 }, earnings)).toBe(false);
  });
});
