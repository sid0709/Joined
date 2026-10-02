import {
  EMPLOYMENT_LABEL,
  EMPLOYMENTS,
  PAY_PERIODS,
  SENIORITIES,
  SENIORITY_LABEL,
  WORKPLACES,
  WORKPLACE_LABEL,
  type Employment,
  type PayPeriod,
  type Seniority,
  type Workplace,
} from "@joined/job-schema";

export {
  EMPLOYMENT_LABEL,
  EMPLOYMENTS,
  PAY_PERIODS,
  SENIORITIES,
  SENIORITY_LABEL,
  WORKPLACES,
  WORKPLACE_LABEL,
};

export const SEARCH_JOBS_PATH = "/v1/jobs";

/** Where a public job came from, as GET /v1/jobs filters it. */
export const JOB_SOURCES = [
  { value: "aggregated", label: "Aggregated" },
  { value: "scouted", label: "Scouted" },
  { value: "direct", label: "Direct" },
] as const;

/** Sort keys GET /v1/jobs accepts. */
export const JOB_SORTS = {
  analyzed: "analyzed",
  posted: "posted",
  title: "title",
  company: "company",
  completion: "completion",
  pay: "pay",
} as const;
export const SEARCH_JOBS_PAGE_SIZE = 25;

export type SearchPay = {
  min: number;
  max: number;
  currency: string;
  period: PayPeriod;
};

/** Matches joined-frontend/lib/jobs/types.ts Job. */
export type SearchJob = {
  id: string;
  title: string;
  company: string;
  companyId: string;
  location: string;
  workplace: Workplace;
  pay: SearchPay;
  seniority: Seniority;
  employment: Employment;
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
  createdBy?: string;
  source?: string;
};

export type AnalyzeBatch = {
  model: string;
  analyzed: SearchRecord[];
  failed: { tempJobId: string; error: string }[];
};

/** One Job pool row: the public job and how complete it is. */
export type JobRow = SearchRecord & {
  /** Percentage of the job's facts that are filled in. */
  completion: number;
};

export type SearchJobList = {
  jobs: JobRow[];
  total: number;
  page: number;
  pageSize: number;
  pending: number;
};

/** Every field an admin can edit on an analyzed job, sent as the full record on save. */
export type SearchJobPatch = {
  title: string;
  company: string;
  location: string;
  workplace: SearchJob["workplace"];
  pay: SearchPay;
  seniority: SearchJob["seniority"];
  employment: SearchJob["employment"];
  visa: boolean;
  team: string;
  skills: string[];
  summary: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  applyLink: string;
};

export function searchJobPatchFrom(record: SearchRecord): SearchJobPatch {
  return {
    title: record.job.title,
    company: record.job.company,
    location: record.job.location,
    workplace: record.job.workplace,
    pay: record.job.pay,
    seniority: record.job.seniority,
    employment: record.job.employment,
    visa: record.job.visa,
    team: record.job.team,
    skills: record.job.skills,
    summary: record.job.summary,
    responsibilities: record.job.responsibilities,
    requirements: record.job.requirements,
    benefits: record.job.benefits,
    applyLink: record.applyLink,
  };
}
