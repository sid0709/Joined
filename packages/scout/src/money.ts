import type { Money } from "./types";

const CENTS_PER_UNIT = 100;
const LOCALE = "en-US";

/** Formats integer cents for display; whole amounts drop the decimals. */
export function formatMoney(money: Money | null | undefined) {
  const cents = money?.amount_cents ?? 0;
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: money?.currency || "USD",
    minimumFractionDigits: cents % CENTS_PER_UNIT === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / CENTS_PER_UNIT);
}

/** Adds amounts that share a currency. */
export function sumMoney(amounts: Money[], currency = "USD"): Money {
  return {
    amount_cents: amounts.reduce((total, money) => total + money.amount_cents, 0),
    currency: amounts[0]?.currency ?? currency,
  };
}

/** A 0–1 ratio as a whole-number percentage. */
export function formatRate(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}
