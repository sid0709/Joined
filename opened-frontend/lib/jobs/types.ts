import type { Employment, PayPeriod, Seniority, Workplace } from "@openseat/job-schema";

export type { Employment, PayPeriod, Seniority, Workplace };

export type JobSource = "direct" | "aggregated" | "scouted";

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
  /** Opaque company id. Company pages and job links use this, not a name slug. */
  companyId: string;
  companyUrl?: string;
  companyLogo?: string;
  companyProfile?: PublicCompany;
  location: string;
  workplace: Workplace;
  pay: Pay;
  seniority: Seniority;
  employment: Employment;
  /** Hours since the job went live — sample data stays "fresh" whenever it is viewed. */
  postedHoursAgo: number;
  source: JobSource;
  /** Scrape or ATS origin from the temp listing, such as Greenhouse. */
  listingSource?: string;
  createdBy?: string;
  visa: boolean;
  applicants: number;
  team: string;
  skills: string[];
  summary: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  description?: string;
  /** Official listing. Apply and copy link use this for aggregated jobs. */
  applyLink?: string;
};

/** A company the seeker can open. Profile fields are present once an admin has saved them. */
export type PublicCompany = {
  id: string;
  name: string;
  url?: string;
  logo?: string;
  tagline?: string;
  about?: string;
  industry?: string;
  size?: string;
  founded?: number;
  replyDays?: number;
  headquarters?: string;
  companyType?: string;
  /** Offices as one line. When unset, the page uses locations from live jobs. */
  locations?: string;
  specialties?: string[];
  mission?: string;
  values?: { icon: string; title: string; description: string }[];
  benefitCategories?: { label: string; items: string[] }[];
  hasLogoFile?: boolean;
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
