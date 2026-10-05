import { describe, expect, test } from "bun:test";
import {
  BILLING_PLANS,
  checkoutRequest,
  currentBillingPlan,
  formatRenewalDate,
  hasStripeCustomer,
  isBillingPlan,
  parseBillingPlan,
  parseSubscriptionStatus,
  planAmountCents,
  planIntervalLabel,
  planLabel,
  portalRequest,
  SUBSCRIPTION_STATUSES,
  subscriptionStatusMeta,
  yearlySavingsCents,
  type PremiumPrices,
} from "./billing";
import { ROUTES, settingsSectionHref } from "./routes";

const PRICES: PremiumPrices = { monthlyCents: 2900, yearlyCents: 29000, currency: "USD" };

describe("billing plans", () => {
  test("parses monthly and yearly and rejects anything else", () => {
    expect(parseBillingPlan("monthly")).toBe("monthly");
    expect(parseBillingPlan("yearly")).toBe("yearly");
    expect(parseBillingPlan("weekly")).toBe(null);
    expect(parseBillingPlan("")).toBe(null);
    expect(parseBillingPlan(undefined)).toBe(null);
    expect(isBillingPlan("monthly")).toBe(true);
    expect(isBillingPlan("yearly")).toBe(true);
    expect(isBillingPlan("weekly")).toBe(false);
    expect(isBillingPlan(null)).toBe(false);
  });

  test("labels every plan", () => {
    expect(BILLING_PLANS.map(planLabel)).toEqual(["Monthly", "Yearly"]);
    expect(BILLING_PLANS.map(planIntervalLabel)).toEqual(["month", "year"]);
  });

  test("plan amounts come from config cents, not literals in the UI", () => {
    expect(planAmountCents("monthly", PRICES)).toBe(2900);
    expect(planAmountCents("yearly", PRICES)).toBe(29000);
    expect(yearlySavingsCents(PRICES.monthlyCents, PRICES.yearlyCents)).toBe(5800);
  });
});

describe("subscription status", () => {
  test("maps known Stripe statuses", () => {
    expect(parseSubscriptionStatus("active")).toBe("active");
    expect(parseSubscriptionStatus("past_due")).toBe("past_due");
    expect(parseSubscriptionStatus("nope")).toBe(null);
    expect(subscriptionStatusMeta("active")).toEqual({ label: "Active", badge: "success" });
    expect(subscriptionStatusMeta("mystery")).toEqual({ label: "mystery", badge: "neutral" });
    expect(subscriptionStatusMeta(undefined)).toEqual({ label: "Unknown", badge: "neutral" });
    expect(subscriptionStatusMeta(null)).toEqual({ label: "Unknown", badge: "neutral" });
  });

  test("labels every persisted Stripe status", () => {
    const expected = {
      active: { label: "Active", badge: "success" },
      trialing: { label: "Trial", badge: "info" },
      past_due: { label: "Past due", badge: "warning" },
      canceled: { label: "Canceled", badge: "neutral" },
      unpaid: { label: "Unpaid", badge: "warning" },
      incomplete: { label: "Incomplete", badge: "warning" },
      incomplete_expired: { label: "Expired", badge: "neutral" },
    } as const;
    for (const status of SUBSCRIPTION_STATUSES) {
      expect(parseSubscriptionStatus(status)).toBe(status);
      expect(subscriptionStatusMeta(status)).toEqual(expected[status]);
    }
  });

  test("portal is available once Stripe has a customer mapping", () => {
    expect(hasStripeCustomer(undefined)).toBe(false);
    expect(hasStripeCustomer({ premium: false })).toBe(false);
    expect(hasStripeCustomer({ premium: true })).toBe(true);
    expect(hasStripeCustomer({ premium: false, status: "canceled" })).toBe(true);
    expect(hasStripeCustomer({ premium: false, plan: "monthly" })).toBe(true);
  });

  test("current plan is only the Premium interval", () => {
    expect(currentBillingPlan({ premium: false, plan: "monthly" })).toBe(null);
    expect(currentBillingPlan({ premium: true, plan: "yearly" })).toBe("yearly");
    expect(currentBillingPlan({ premium: true, plan: "weekly" })).toBe(null);
  });

  test("renewal date formats RFC3339 and falls back when missing", () => {
    expect(formatRenewalDate(undefined)).toBe("—");
    expect(formatRenewalDate(null)).toBe("—");
    expect(formatRenewalDate("")).toBe("—");
    expect(formatRenewalDate("not-a-date")).toBe("—");
    expect(formatRenewalDate(new Date(2026, 9, 5).toISOString())).toContain("2026");
  });
});

describe("checkout and portal bodies", () => {
  test("wires success and cancel URLs onto the current origin", () => {
    expect(checkoutRequest("monthly", "https://app.test")).toEqual({
      plan: "monthly",
      success_url: `https://app.test${ROUTES.billingSuccess}`,
      cancel_url: `https://app.test${ROUTES.billingCancel}`,
    });
    expect(checkoutRequest("yearly", "https://app.test").plan).toBe("yearly");
  });

  test("portal returns to settings billing", () => {
    expect(portalRequest("https://app.test")).toEqual({
      return_url: `https://app.test${settingsSectionHref("billing")}`,
    });
  });
});
