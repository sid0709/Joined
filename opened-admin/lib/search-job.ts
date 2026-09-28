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
  seniority: "Junior" | "Middle" | "Senior" | "Leader" | "Manager";
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

export const WORKPLACES: SearchJob["workplace"][] = ["remote", "hybrid", "onsite"];
/** Staff and Principal are senior IC titles, one tier above Senior — Leader, never Senior. */
export const SENIORITIES: SearchJob["seniority"][] = [
  "Junior",
  "Middle",
  "Senior",
  "Leader",
  "Manager",
];
export const EMPLOYMENTS: SearchJob["employment"][] = ["full-time", "contract", "part-time"];
export const PAY_PERIODS: SearchPay["period"][] = ["year", "hour"];

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
