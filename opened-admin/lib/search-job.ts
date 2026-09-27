export const SEARCH_JOBS_PATH = "/v1/jobs";
export const SEARCH_JOBS_PAGE_SIZE = 25;

export type SearchPay = {
  min: number;
  max: number;
  currency: string;
  period: "year" | "hour";
};

/** Matches opened-frontend/lib/jobs/types.ts Job. */
export type SearchJob = {
  id: string;
  title: string;
  company: string;
  companyId: string;
  location: string;
  workplace: "remote" | "hybrid" | "onsite";
  pay: SearchPay;
  seniority: "Junior" | "Mid" | "Senior" | "Lead";
  employment: "full-time" | "contract" | "part-time";
  postedHoursAgo: number;
  source: "direct" | "aggregated" | "scouted";
  visa: boolean;
  applicants: number;
  team: string;
  skills: string[];
  summary: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
};

export type SearchRecord = {
  job: SearchJob;
  tempJobId: string;
  applyLink: string;
  analyzedAt: string;
  model: string;
};

export type AnalyzeBatch = {
  model: string;
  analyzed: SearchRecord[];
  failed: { tempJobId: string; error: string }[];
};

export type SearchJobList = {
  jobs: SearchRecord[];
  total: number;
  page: number;
  pageSize: number;
  pending: number;
};
