const JOINED_API_URL_KEY = "JOINED_API_URL";
const COMPANY_MODE_ENABLED_KEY = "NEXT_PUBLIC_COMPANY_MODE_ENABLED";
/** Same names as backend-core/billing config (step-29). */
const PREMIUM_MONTHLY_PRICE_CENTS_KEY = "PREMIUM_MONTHLY_PRICE_CENTS";
const PREMIUM_YEARLY_PRICE_CENTS_KEY = "PREMIUM_YEARLY_PRICE_CENTS";
const BILLING_CHECKOUT_ENABLED_KEY = "BILLING_CHECKOUT_ENABLED";
const PUBLIC_BILLING_CHECKOUT_ENABLED_KEY = "NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED";

/** Defaults match backend-core/billing when the env vars are unset. */
const DEFAULT_PREMIUM_MONTHLY_PRICE_CENTS = 2900;
const DEFAULT_PREMIUM_YEARLY_PRICE_CENTS = 29000;
export const PREMIUM_CURRENCY = "USD";

export function joinedApiUrl(): string {
  const url = process.env[JOINED_API_URL_KEY];
  if (!url) {
    throw new Error("JOINED_API_URL is not set");
  }
  return url.replace(/\/$/, "");
}

export function isCompanyModeEnabled(): boolean {
  return process.env[COMPANY_MODE_ENABLED_KEY] === "true";
}

/** Monthly Premium price in cents from the step-29 billing config. */
export function premiumMonthlyPriceCents(): number {
  return envInt(PREMIUM_MONTHLY_PRICE_CENTS_KEY, DEFAULT_PREMIUM_MONTHLY_PRICE_CENTS);
}

/** Yearly Premium price in cents from the step-29 billing config. */
export function premiumYearlyPriceCents(): number {
  return envInt(PREMIUM_YEARLY_PRICE_CENTS_KEY, DEFAULT_PREMIUM_YEARLY_PRICE_CENTS);
}

export function premiumPrices() {
  return {
    monthlyCents: premiumMonthlyPriceCents(),
    yearlyCents: premiumYearlyPriceCents(),
    currency: PREMIUM_CURRENCY,
  };
}

/**
 * Checkout kill switch. Defaults on. Either env name set to "false" or "0"
 * hides Upgrade (step-26, if that flag lands under these names).
 */
export function isBillingCheckoutEnabled(): boolean {
  return !(
    envDisabled(BILLING_CHECKOUT_ENABLED_KEY) || envDisabled(PUBLIC_BILLING_CHECKOUT_ENABLED_KEY)
  );
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function envDisabled(key: string): boolean {
  const value = process.env[key]?.trim().toLowerCase();
  return value === "false" || value === "0";
}
