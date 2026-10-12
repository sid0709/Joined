import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  EMPLOYMENT_LABEL,
  EMPLOYMENT_OPTIONS,
  PAY_ESTIMATED_LABEL,
  PAY_LISTED_LABEL,
  PAY_UNKNOWN_LABEL,
  SENIORITY_LABEL,
  SENIORITY_OPTIONS,
  WORKPLACE_LABEL,
  WORKPLACE_OPTIONS,
} from "@joined/job-schema";

export {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  EMPLOYMENT_LABEL,
  EMPLOYMENT_OPTIONS,
  PAY_ESTIMATED_LABEL,
  PAY_LISTED_LABEL,
  PAY_UNKNOWN_LABEL,
  SENIORITY_LABEL,
  SENIORITY_OPTIONS,
  WORKPLACE_LABEL,
  WORKPLACE_OPTIONS,
};

import type { Job, JobSource, Pay } from "./types";

const LOCALE = "en-US";
const HOURS_PER_DAY = 24;
const THOUSAND = 1_000;
/** Full-time hours in a year, used to compare hourly and salaried pay. */
export const HOURS_PER_YEAR = 2_080;

export const SOURCE_LABEL: Record<JobSource, string> = {
  direct: "Posted here",
  aggregated: "Aggregated",
  scouted: "Hidden job",
};

export const SOURCE_DESCRIPTION: Record<JobSource, string> = {
  direct: "Apply here with your profile and resume.",
  aggregated: "Opens the official listing on the company’s site.",
  scouted: "Shared by a scout before it reaches the big boards.",
};

function currencySymbol(currency: string) {
  return (
    new Intl.NumberFormat(LOCALE, { style: "currency", currency })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency
  );
}

/** "$140k" for salaries, "$80" for hourly rates. */
export function formatAmount(amount: number, currency: string, period: Pay["period"] = "year") {
  const symbol = currencySymbol(currency);
  return period === "year" ? `${symbol}${Math.round(amount / THOUSAND)}k` : `${symbol}${amount}`;
}

/** "$140k–$170k", "$80–$100/hr", "$120k+", "Up to $150k", or "Pay not listed". */
export function formatPay(pay: Pay) {
  const hasMin = pay.min > 0;
  const hasMax = pay.max > 0;
  if (!hasMin && !hasMax) return PAY_UNKNOWN_LABEL;
  const min = formatAmount(pay.min, pay.currency, pay.period);
  const max = formatAmount(pay.max, pay.currency, pay.period);
  const range = !hasMax
    ? `${min}+`
    : !hasMin
      ? `Up to ${max}`
      : pay.min === pay.max
        ? max
        : `${min}–${max}`;
  return pay.period === "hour" ? `${range}/hr` : range;
}

/** "Listed" or "Estimated" when a range exists. Empty when pay is unknown. */
export function paySourceLabel(pay: Pay) {
  if (pay.min <= 0 && pay.max <= 0) return "";
  return pay.estimated ? PAY_ESTIMATED_LABEL : PAY_LISTED_LABEL;
}

/** The range plus whether it came from the posting or a published average. */
export function formatPayWithSource(pay: Pay) {
  const source = paySourceLabel(pay);
  const range = formatPay(pay);
  return source ? `${range} · ${source}` : range;
}

/** Pay as a yearly figure, so hourly contracts sort and filter beside salaries. */
export function annualPay(pay: Pay, bound: "min" | "max" = "max") {
  const value = pay[bound];
  return pay.period === "hour" ? value * HOURS_PER_YEAR : value;
}

/** "4h ago", "Yesterday", "5d ago". */
export function formatPosted(hoursAgo: number) {
  if (hoursAgo < 1) return "Just now";
  if (hoursAgo < HOURS_PER_DAY) return `${Math.floor(hoursAgo)}h ago`;
  const days = Math.floor(hoursAgo / HOURS_PER_DAY);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

export const NEW_JOB_HOURS = HOURS_PER_DAY;

export function isNew(job: Job) {
  return job.postedHoursAgo < NEW_JOB_HOURS;
}

export function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString(LOCALE)} ${count === 1 ? singular : plural}`;
}

const COMPACT_COUNT = new Intl.NumberFormat(LOCALE, {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** "23.8K": a count short enough to sit inside a filter chip. */
export function formatCompactCount(count: number) {
  return COMPACT_COUNT.format(count);
}
