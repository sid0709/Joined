import type { Balance, Earning, EarningsSummary, Money } from "@joined/scout";

export type EarningsCards = {
  total: Money;
  pending: Money;
  paid: Money;
  released: Money;
};

/** Job · company when a line is tied to a submission; otherwise the API description. */
export function earningJobLabel(row: Earning) {
  if (row.job_title) {
    return row.company_name ? `${row.job_title} · ${row.company_name}` : row.job_title;
  }
  return row.description;
}

/**
 * Dashboard cards: lifetime earned, still held, and already paid.
 * `summary.total` is released-only; it is kept as a supporting figure.
 */
export function earningsCards(balance: Balance, summary: EarningsSummary): EarningsCards {
  return {
    total: balance.lifetime,
    pending: balance.held,
    paid: balance.paid,
    released: summary.total,
  };
}
