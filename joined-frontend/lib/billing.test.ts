import { describe, expect, test } from "bun:test";
import {
  BILLING_PLANS,
  checkoutRequest,
  currentBillingPlan,
  formatRenewalDate,
  hasStripeCustomer,
  parseBillingPlan,
  parseSubscriptionStatus,
  planAmountCents,
  planIntervalLabel,
  planLabel,
  portalRequest,
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
  });

  test("portal is available once Stripe has a customer mapping", () => {
    expect(hasStripeCustomer(null)).toBe(false);
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
  });

  test("portal returns to settings billing", () => {
    expect(portalRequest("https://app.test")).toEqual({
      return_url: `https://app.test${settingsSectionHref("billing")}`,
    });
  });
});
