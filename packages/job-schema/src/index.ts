/**
 * Job enums shared by Joined, Scoutwell, and admin.
 *
 * enums.json is the file the Go backend checks in
 * backend-core/jobschema. Edit both together; the tests fail when
 * they drift. Go cannot embed a file outside its module, so the JSON is the
 * cross-language copy and this module is what TypeScript imports.
 *
 * Seniority values match the search record. "Leader" is the lead tier — staff,
 * principal, and lead titles — shown to people as "Lead".
 */

export const WORKPLACES = ["remote", "hybrid", "onsite"] as const;
export type Workplace = (typeof WORKPLACES)[number];

export const SENIORITIES = ["Junior", "Middle", "Senior", "Leader", "Manager"] as const;
export type Seniority = (typeof SENIORITIES)[number];

export const EMPLOYMENTS = ["full-time", "contract", "part-time"] as const;
export type Employment = (typeof EMPLOYMENTS)[number];

export const PAY_PERIODS = ["year", "hour"] as const;
export type PayPeriod = (typeof PAY_PERIODS)[number];

export const DEFAULT_CURRENCY = "USD";

/** The catch-all in every company enum. Pick it when nothing else fits. */
export const OTHER = "Other";

export const INDUSTRIES = [
  "Accounting",
  "Advertising",
  "Agriculture",
  "Architecture",
  "Construction",
  "Consulting",
  "Education",
  "Energy",
  "Entertainment",
  "Finance",
  "Food",
  "Government",
  "Healthcare",
  "Hospitality",
  "Insurance",
  "Legal",
  "Manufacturing",
  "Media",
  "Nonprofit",
  "Real estate",
  "Retail",
  "Software",
  "Telecommunications",
  "Transportation",
  "Other",
] as const;

export const COMPANY_TYPES = [
  "Private",
  "Public",
  "Nonprofit",
  "Government",
  "Educational",
  "Partnership",
  "Cooperative",
  "Other",
] as const;

export const COMPANY_SIZES = [
  "1–10",
  "11–50",
  "51–200",
  "201–500",
  "501–1,000",
  "1,001–5,000",
  "5,000+",
  "Other",
] as const;

export const VALUE_ICONS = [
  "heart",
  "star",
  "users",
  "check",
  "sparkle",
  "home",
  "pin",
  "code",
  "seat",
  "chat",
] as const;

/** "11–50" reads "11–50 people"; "Other" stays "Other". */
export function companySizeLabel(size: string) {
  return size === OTHER ? size : `${size} people`;
}

/** A company page lists up to this many benefits. Each is its own category with one line. */
export const MAX_BENEFITS = 12;

export type Industry = (typeof INDUSTRIES)[number];
export type CompanyType = (typeof COMPANY_TYPES)[number];
export type CompanySize = (typeof COMPANY_SIZES)[number];
export type ValueIcon = (typeof VALUE_ICONS)[number];

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD"] as const;
export type JobCurrency = (typeof CURRENCIES)[number];

export const WORKPLACE_LABEL: Record<Workplace, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
};

export const SENIORITY_LABEL: Record<Seniority, string> = {
  Junior: "Junior",
  Middle: "Middle",
  Senior: "Senior",
  Leader: "Lead",
  Manager: "Manager",
};

export const EMPLOYMENT_LABEL: Record<Employment, string> = {
  "full-time": "Full-time",
  contract: "Contract",
  "part-time": "Part-time",
};

export const PAY_PERIOD_LABEL: Record<PayPeriod, string> = {
  year: "Per year",
  hour: "Per hour",
};

/** Older scout values, and any casing, fold onto the job-record seniority. */
export const SENIORITY_ALIASES = {
  entry: "Junior",
  junior: "Junior",
  mid: "Middle",
  middle: "Middle",
  senior: "Senior",
  lead: "Leader",
  leader: "Leader",
  manager: "Manager",
} as const satisfies Record<string, Seniority>;

export type Pay = {
  min: number;
  max: number;
  currency: string;
  period: PayPeriod;
};

function options<T extends string>(values: readonly T[], labels: Record<T, string>) {
  return values.map((value) => ({ value, label: labels[value] }));
}

export const WORKPLACE_OPTIONS = options(WORKPLACES, WORKPLACE_LABEL);
export const SENIORITY_OPTIONS = options(SENIORITIES, SENIORITY_LABEL);
export const EMPLOYMENT_OPTIONS = options(EMPLOYMENTS, EMPLOYMENT_LABEL);
export const PAY_PERIOD_OPTIONS = options(PAY_PERIODS, PAY_PERIOD_LABEL);
export const CURRENCY_OPTIONS = CURRENCIES.map((value) => ({ value, label: value }));

export function canonicalSeniority(value: string): Seniority | null {
  const key = value.trim().toLowerCase();
  if (key in SENIORITY_ALIASES) return SENIORITY_ALIASES[key as keyof typeof SENIORITY_ALIASES];
  return null;
}

export function seniorityLabel(value: string) {
  const canonical = canonicalSeniority(value);
  return canonical ? SENIORITY_LABEL[canonical] : value;
}
