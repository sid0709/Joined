import { parseDuplicateWindowDays } from "../config/duplicateWindow.js";
import { isHttpUrl } from "../lib/httpUrl.js";

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const JOB_VALIDATION_RULES = [
  {
    field: "title",
    issue: "Job title",
    validate: (job) => hasText(job.title),
  },
  {
    field: "postedAgo",
    issue: "Posted date",
    validate: (job) => hasText(job.postedAgo),
  },
  {
    field: "tags",
    issue: "Job tags",
    validate: (job) => Array.isArray(job.tags),
  },
  {
    field: "skills",
    issue: "Skills",
    validate: (job) => Array.isArray(job.skills),
  },
  {
    field: "description",
    issue: "Job description",
    validate: (job) => hasText(job.description),
  },
  {
    field: "details",
    issue: "Job details",
    validate: (job) => isRecord(job.details),
  },
  {
    field: "applyLink",
    issue: "Application link",
    validate: (job) => isHttpUrl(job.applyLink),
  },
  {
    field: "companyLink",
    issue: "Company link",
    validate: (job) => !hasText(job.companyLink) || isHttpUrl(job.companyLink),
  },
  {
    field: "company.name",
    issue: "Company name",
    validate: (job) => isRecord(job.company) && hasText(job.company.name),
  },
  {
    field: "company.logo",
    issue: "Company logo",
    validate: (job) => isRecord(job.company) && isHttpUrl(job.company.logo),
  },
  {
    field: "company.tags",
    issue: "Company tags",
    validate: (job) => isRecord(job.company) && Array.isArray(job.company.tags),
  },
  {
    field: "id",
    issue: "Job ID",
    validate: (job) => typeof job.id === "number" && Number.isFinite(job.id),
  },
  {
    field: "duplicateWindowDays",
    issue: "Duplicate window",
    validate: (job) =>
      parseDuplicateWindowDays(job.duplicateWindowDays) === job.duplicateWindowDays,
  },
];

/**
 * Whether the job's field at `path` (e.g. "company.name") passes its rules.
 * Null when no rule checks that field.
 */
export function isJobFieldValid(job, path) {
  const rules = JOB_VALIDATION_RULES.filter((rule) => rule.field === path);
  if (!rules.length) return null;
  return isRecord(job) && rules.every((rule) => rule.validate(job));
}

/**
 * Validate the complete job payload before it can leave the extension.
 * Arrays and metadata objects may legitimately be empty, but they must exist
 * with the expected shape. Core scraped content must be non-empty.
 * Company website is optional: omit it when missing; if present it must be http(s).
 */
export function getJobValidationIssues(job) {
  if (!isRecord(job)) return ["Job data"];
  return JOB_VALIDATION_RULES.filter((rule) => !rule.validate(job)).map((rule) => rule.issue);
}

export class IncompleteJobDataError extends Error {
  constructor(issues) {
    const uniqueIssues = [...new Set(issues)];
    super(`Skipping job. Missing or invalid required job data: ${uniqueIssues.join(", ")}.`);
    this.name = "IncompleteJobDataError";
    this.issues = uniqueIssues;
  }
}

export function assertCompleteJob(job) {
  const issues = getJobValidationIssues(job);
  if (issues.length) throw new IncompleteJobDataError(issues);
  return job;
}
