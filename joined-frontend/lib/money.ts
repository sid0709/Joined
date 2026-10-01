const LOCALE = "en-US";
const CENTS_PER_UNIT = 100;

/** Money is stored as integer cents; format only for display. */
export function formatCents(cents: number, currency: string) {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits: cents % CENTS_PER_UNIT === 0 ? 0 : 2,
  }).format(cents / CENTS_PER_UNIT);
}
