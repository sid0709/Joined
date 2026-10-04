import { parseDuplicateWindowDays } from "../config/duplicateWindow.js";

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isHttpUrl(value) {
  if (!hasText(value)) return false;
  try {
    const url = new URL(value.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/** Keep a company website only when it is a real http(s) URL; otherwise omit it. */
export function normalizeOptionalHttpUrl(value) {
  return isHttpUrl(value) ? value.trim() : "";
}

const JOB_VALIDATION_RULES = [
  { id: "title", label: "Job title", issue: "Job title", validate: (job) => hasText(job.title) },
  {
    id: "postedAgo",
    label: "Posted date",
    issue: "Posted date",
    validate: (job) => hasText(job.postedAgo),
  },
  { id: "tags", label: "Job tags", issue: "Job tags", validate: (job) => Array.isArray(job.tags) },
  { id: "skills", label: "Skills", issue: "Skills", validate: (job) => Array.isArray(job.skills) },
  {
    id: "description",
    label: "Description",
    issue: "Job description",
    validate: (job) => hasText(job.description),
  },
  {
    id: "details",
    label: "Job details",
    issue: "Job details",
    validate: (job) => isRecord(job.details),
  },
  {
    id: "applyLink",
    label: "Apply link",
    issue: "Application link",
    validate: (job) => isHttpUrl(job.applyLink),
  },
  {
    id: "companyLink",
    label: "Website",
    issue: "Company link",
    validate: (job) => !hasText(job.companyLink) || isHttpUrl(job.companyLink),
  },
  {
    id: "companyName",
    label: "Company",
    issue: "Company name",
    validate: (job) => isRecord(job.company) && hasText(job.company.name),
  },
  {
    id: "companyLogo",
    label: "Logo",
    issue: "Company logo",
    validate: (job) => isRecord(job.company) && isHttpUrl(job.company.logo),
  },
  {
    id: "companyTags",
    label: "Company tags",
    issue: "Company tags",
    validate: (job) => isRecord(job.company) && Array.isArray(job.company.tags),
  },
  {
    id: "id",
    label: "Job ID",
    issue: "Job ID",
    visible: false,
    validate: (job) => typeof job.id === "number" && Number.isFinite(job.id),
  },
  {
    id: "duplicateWindowDays",
    label: "Duplicate window",
    issue: "Duplicate window",
    visible: false,
    validate: (job) =>
      parseDuplicateWindowDays(job.duplicateWindowDays) === job.duplicateWindowDays,
  },
];

function evaluateJobValidationRules(job, completedRuleIds = null) {
  const completed = completedRuleIds === null ? null : new Set(completedRuleIds);

  return JOB_VALIDATION_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    issue: rule.issue,
    visible: rule.visible !== false,
    status:
      completed !== null && !completed.has(rule.id)
        ? "pending"
        : rule.validate(job)
          ? "valid"
          : "invalid",
  }));
}

/** Return user-facing validation states for the scraper checklist. */
export function getJobValidationChecklist(job = {}, completedRuleIds = null) {
  const candidate = isRecord(job) ? job : {};
  return evaluateJobValidationRules(candidate, completedRuleIds).filter((result) => result.visible);
}

/** Merge only newly completed rules, preserving every earlier checklist result. */
export function mergeJobValidationChecklist(current, partialJob, completedRuleIds) {
  const completed = new Set(completedRuleIds);
  const updates = new Map(
    getJobValidationChecklist(partialJob, completedRuleIds)
      .filter((result) => completed.has(result.id))
      .map((result) => [result.id, result]),
  );
  return current.map((result) => updates.get(result.id) || result);
}

/**
 * Validate the complete job payload before it can leave the extension.
 * Arrays and metadata objects may legitimately be empty, but they must exist
 * with the expected shape. Core scraped content must be non-empty.
 * Company website is optional: omit it when missing; if present it must be http(s).
 */
export function getJobValidationIssues(job) {
  if (!isRecord(job)) return ["Job data"];
  return evaluateJobValidationRules(job)
    .filter((result) => result.status === "invalid")
    .map((result) => result.issue);
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
