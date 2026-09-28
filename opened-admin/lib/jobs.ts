export const TEMP_JOB_PAGE_SIZES = [25, 50, 100] as const;
export const TEMP_JOBS_PAGE_SIZE = TEMP_JOB_PAGE_SIZES[0];
export const MAX_ANALYZE_SELECTION = 100;
export const SEARCH_DEBOUNCE_MS = 300;
export const TEMP_JOBS_PATH = "/v1/jobs/temp";
export const ADMIN_SETTINGS_PATH = "/v1/settings";

export type JobDetails = {
  location?: string;
  time?: string;
  remote?: string;
  seniority?: string;
  salary?: string;
};

export type JobSkill = {
  name?: string;
  category?: string;
  requirement?: number;
};

export type TempJob = {
  _id: string;
  title?: string;
  companyName?: string;
  companyLink?: string;
  applyLink?: string;
  source?: string;
  sourceCatalog?: string;
  titleReviewLabel?: string;
  aiSkillStatus?: string;
  postedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  companyId?: string;
  description?: string;
  createdBy?: string;
  model_schema_code?: string;
  aiSkills?: JobSkill[];
  metadata?: {
    companyLogo?: string;
    legacyId?: string;
    details?: JobDetails;
    titleReview?: {
      label?: string;
      reason?: string;
      confidence?: number;
      originalTitle?: string;
    };
  };
};

export type TempJobList = {
  jobs: TempJob[];
  analyzedIds: string[];
  total: number;
  page: number;
  pageSize: number;
};

export type CopyResult = {
  copied: number;
  source: string;
  destination: string;
  indexes: number;
};
