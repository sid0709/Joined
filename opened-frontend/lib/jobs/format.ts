import type { Employment, Job, JobSource, Pay, Seniority, Workplace } from "./types";

const LOCALE = "en-US";
const HOURS_PER_DAY = 24;
const THOUSAND = 1_000;
/** Full-time hours in a year, used to compare hourly and salaried pay. */
export const HOURS_PER_YEAR = 2_080;

export const WORKPLACE_LABEL: Record<Workplace, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
};

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

export const EMPLOYMENT_LABEL: Record<Employment, string> = {
  "full-time": "Full-time",
  contract: "Contract",
  "part-time": "Part-time",
};

export const SENIORITY_LABEL: Record<Seniority, string> = {
  Junior: "Junior",
  Mid: "Mid-level",
  Senior: "Senior",
  Lead: "Lead",
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

/** "$140k–$170k" or "$80–$100/hr". */
export function formatPay(pay: Pay) {
  const range = `${formatAmount(pay.min, pay.currency, pay.period)}–${formatAmount(pay.max, pay.currency, pay.period)}`;
  return pay.period === "hour" ? `${range}/hr` : range;
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
