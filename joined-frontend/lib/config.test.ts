import { afterEach, describe, expect, test } from "bun:test";
import {
  isBillingCheckoutEnabled,
  isCompanyModeEnabled,
  joinedApiUrl,
  joinedWebOrigin,
  joinedWebUrl,
  PREMIUM_CURRENCY,
  premiumMonthlyPriceCents,
  premiumPrices,
  premiumYearlyPriceCents,
} from "./config";

const KEYS = [
  "JOINED_API_URL",
  "JOINED_WEB_URL",
  "NEXT_PUBLIC_COMPANY_MODE_ENABLED",
  "PREMIUM_MONTHLY_PRICE_CENTS",
  "PREMIUM_YEARLY_PRICE_CENTS",
  "BILLING_CHECKOUT_ENABLED",
  "NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED",
] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("config", () => {
  test("joinedApiUrl is required and loses its trailing slash", () => {
    delete process.env.JOINED_API_URL;
    expect(() => joinedApiUrl()).toThrow("JOINED_API_URL is not set");
    process.env.JOINED_API_URL = "http://api.test/";
    expect(joinedApiUrl()).toBe("http://api.test");
    process.env.JOINED_API_URL = "http://api.test";
    expect(joinedApiUrl()).toBe("http://api.test");
  });

  test("joinedWebUrl is optional and loses its trailing slash", () => {
    delete process.env.JOINED_WEB_URL;
    expect(joinedWebUrl()).toBe("");
    process.env.JOINED_WEB_URL = "https://joined.test/";
    expect(joinedWebUrl()).toBe("https://joined.test");
    process.env.JOINED_WEB_URL = "https://joined.test";
    expect(joinedWebUrl()).toBe("https://joined.test");
    expect(joinedWebOrigin()?.toString()).toBe("https://joined.test/");
    process.env.JOINED_WEB_URL = "not a url";
    expect(joinedWebOrigin()).toBeUndefined();
  });

  test("isCompanyModeEnabled reads NEXT_PUBLIC_COMPANY_MODE_ENABLED", () => {
    process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = "true";
    expect(isCompanyModeEnabled()).toBe(true);
    process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = "false";
    expect(isCompanyModeEnabled()).toBe(false);
    delete process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED;
    expect(isCompanyModeEnabled()).toBe(false);
  });

  test("premium prices match step-29 defaults and env overrides", () => {
    delete process.env.PREMIUM_MONTHLY_PRICE_CENTS;
    delete process.env.PREMIUM_YEARLY_PRICE_CENTS;
    expect(premiumMonthlyPriceCents()).toBe(2900);
    expect(premiumYearlyPriceCents()).toBe(29000);
    expect(premiumPrices()).toEqual({
      monthlyCents: 2900,
      yearlyCents: 29000,
      currency: PREMIUM_CURRENCY,
    });

    process.env.PREMIUM_MONTHLY_PRICE_CENTS = "3500";
    process.env.PREMIUM_YEARLY_PRICE_CENTS = "35000";
    expect(premiumPrices()).toEqual({
      monthlyCents: 3500,
      yearlyCents: 35000,
      currency: PREMIUM_CURRENCY,
    });

    process.env.PREMIUM_MONTHLY_PRICE_CENTS = "0";
    process.env.PREMIUM_YEARLY_PRICE_CENTS = "nope";
    expect(premiumMonthlyPriceCents()).toBe(2900);
    expect(premiumYearlyPriceCents()).toBe(29000);
  });

  test("checkout stays on unless a kill switch is explicitly off", () => {
    delete process.env.BILLING_CHECKOUT_ENABLED;
    delete process.env.NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED;
    expect(isBillingCheckoutEnabled()).toBe(true);

    process.env.BILLING_CHECKOUT_ENABLED = "false";
    expect(isBillingCheckoutEnabled()).toBe(false);

    process.env.BILLING_CHECKOUT_ENABLED = "true";
    process.env.NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED = "0";
    expect(isBillingCheckoutEnabled()).toBe(false);
  });
});
