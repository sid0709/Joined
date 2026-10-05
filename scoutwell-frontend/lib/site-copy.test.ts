import { describe, expect, test } from "bun:test";
import { formatMoney, type Meta } from "@joined/scout";

import { earnFigures, EXTENSION_SIGNED_IN_BODY, faqItems } from "./site-copy";

function meta(applyCents = 75): Meta {
  return {
    levels: [
      {
        id: "probation",
        label: "Probation",
        daily_limit: 8,
        auto_approve: false,
        spot_check_rate: 1,
        approval_reward: { amount_cents: 0, currency: "USD" },
        interview_multiplier: 1,
      },
    ],
    promotion: {
      min_approved: 1,
      min_approval_rate: 1,
      max_duplicate_expired_rate: 1,
      min_interview_producing_rate: 0,
      demote_below_approval_rate: 0,
      demote_min_decided: 1,
    },
    rewards: {
      hold_days: 14,
      min_payout: { amount_cents: 2500, currency: "USD" },
      apply_reward: { amount_cents: applyCents, currency: "USD" },
      interview_by_seniority: {
        Junior: { amount_cents: 400, currency: "USD" },
        Middle: { amount_cents: 750, currency: "USD" },
        Senior: { amount_cents: 1500, currency: "USD" },
        Leader: { amount_cents: 1500, currency: "USD" },
        Manager: { amount_cents: 1500, currency: "USD" },
      },
      hire_by_seniority: {
        Junior: { amount_cents: 2500, currency: "USD" },
        Middle: { amount_cents: 5000, currency: "USD" },
        Senior: { amount_cents: 10000, currency: "USD" },
        Leader: { amount_cents: 10000, currency: "USD" },
        Manager: { amount_cents: 10000, currency: "USD" },
      },
      conversion_share: 0.1,
    },
    limits: {
      min_summary_chars: 40,
      max_summary_chars: 400,
      max_batch: 50,
      workplaces: [],
      employments: [],
      seniorities: [],
    },
    rejection_reasons: [],
  };
}

describe("site copy", () => {
  test("earn figures read apply, hold, and payout amounts from meta", () => {
    const figures = earnFigures(meta(125));
    expect(figures.apply).toBe(formatMoney({ amount_cents: 125, currency: "USD" }));
    expect(figures.holdDays).toBe(14);
    expect(figures.minPayout).toBe(formatMoney({ amount_cents: 2500, currency: "USD" }));
    expect(figures.apply).not.toBe("$0.50");
  });

  test("faq answers include the live apply reward, not a hard-coded rate", () => {
    const items = faqItems(meta(333));
    const pay = items.find((item) => item.id === "earn");
    expect(pay?.answer).toContain(formatMoney({ amount_cents: 333, currency: "USD" }));
    expect(pay?.answer).not.toContain("$0.50");
    expect(items.map((item) => item.id)).toEqual([
      "what",
      "earn",
      "install",
      "extension-signin",
      "jobs",
      "limits",
      "payouts",
    ]);
  });

  test("the extension tab uses the close-and-return copy", () => {
    expect(EXTENSION_SIGNED_IN_BODY).toBe("You can close this tab and return to the extension");
  });
});
