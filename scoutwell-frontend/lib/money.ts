import { CURRENCY, LOCALE } from "./config";

const CENTS_PER_UNIT = 100;

/** Money is stored as integer cents; format only for display. */
export function formatCents(cents: number, currency = CURRENCY) {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits: cents % CENTS_PER_UNIT === 0 ? 0 : 2,
  }).format(cents / CENTS_PER_UNIT);
}

export function dollarsToCents(dollars: number) {
  return Math.round(dollars * CENTS_PER_UNIT);
}
