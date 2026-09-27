export type Workplace = "remote" | "hybrid" | "onsite";
export type JobSource = "direct" | "aggregated" | "scouted";
export type Seniority = "Junior" | "Mid" | "Senior" | "Lead";
export type Employment = "full-time" | "contract" | "part-time";
export type PayPeriod = "year" | "hour";

export type Pay = {
  min: number;
  max: number;
  currency: string;
  period: PayPeriod;
};

export type Job = {
  id: string;
  title: string;
  company: string;
  companySlug: string;
  location: string;
  workplace: Workplace;
  pay: Pay;
  seniority: Seniority;
  employment: Employment;
  /** Hours since the job went live — sample data stays "fresh" whenever it is viewed. */
  postedHoursAgo: number;
  source: JobSource;
  visa: boolean;
  applicants: number;
  team: string;
  skills: string[];
  summary: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  /** Official listing. Apply and copy link use this for aggregated jobs. */
  applyLink?: string;
};

export type CompanyProfile = {
  slug: string;
  name: string;
  locations: string;
  about: string;
  industry: string;
  size: string;
  founded: number;
  /** Median days from application to first reply. */
  replyDays: number;
};
