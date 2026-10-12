import { parseDuplicateWindowDays } from "../config/duplicateWindow.js";
import { isHttpUrl } from "../lib/httpUrl.js";
import {
  CORE_JOB_FIELD_KEYS,
  FIELD_TYPES,
  isCoreJobFieldKey,
} from "../routineKit/declaredFields.js";
import { isFound, valueAt } from "../routineKit/html.js";

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const CORE_ISSUES = {
  applyUrl: "Apply URL",
  title: "Job title",
  description: "Job description",
  companyName: "Company name",
};

function fieldIssue(declared) {
  return declared?.label || CORE_ISSUES[declared?.key] || declared?.key || "Job data";
}

function typeOk(declared, value) {
  if (!isFound(value)) return !declared.required;
  switch (declared.type) {
    case FIELD_TYPES.STRING:
    case FIELD_TYPES.DATE:
      return typeof value === "string" || typeof value === "number";
    case FIELD_TYPES.URL:
      return isHttpUrl(value);
    case FIELD_TYPES.NUMBER:
      return typeof value === "number" && Number.isFinite(value);
    case FIELD_TYPES.LIST:
      return Array.isArray(value);
    case FIELD_TYPES.OBJECT:
      return isRecord(value);
    default: {
      const exhaustive = declared.type;
      void exhaustive;
      return true;
    }
  }
}

/**
 * Whether the job's declared field at `path` is valid.
 * Null when the routine does not declare that field.
 */
export function isJobFieldValid(job, path, routine) {
  if (!isRecord(job)) return false;
  const declared = routine?.declaredFields?.find((field) => field.key === path);
  if (!declared) {
    if (path === "id") return typeof job.id === "number" && Number.isFinite(job.id);
    if (path === "duplicateWindowDays") {
      return parseDuplicateWindowDays(job.duplicateWindowDays) === job.duplicateWindowDays;
    }
    return null;
  }
  return typeOk(declared, declaredValue(job, path));
}

function extraValue(job, key) {
  return valueAt(job?.metadata, key) ?? valueAt(job?.metadata?.extra, key);
}

function declaredValue(job, path) {
  switch (path) {
    case "applyUrl":
      return (
        job.applyLink || job.applyUrl || extraValue(job, "apply_url") || extraValue(job, "applyUrl")
      );
    case "companyName":
      return job.companyName || job.company?.name || extraValue(job, "companyName");
    case "companyWebsite":
      return (
        job.companyWebsite ||
        job.company?.website ||
        job.companyLink ||
        extraValue(job, "companyWebsite")
      );
    case "companyProfileUrl":
      return job.companyProfileUrl || job.company?.profileUrl;
    case "companySocials":
      return job.companySocials || job.company?.socials;
    default:
      return valueAt(job, path) ?? extraValue(job, path);
  }
}

/**
 * Validate the complete job payload before it can leave the extension.
 * Only the core applyUrl, title, description, and companyName are required.
 * Optional declared fields may be empty. A present URL must be http(s).
 */
export function getJobValidationIssues(job, routine) {
  if (!isRecord(job)) return ["Job data"];
  const issues = [];
  for (const key of CORE_JOB_FIELD_KEYS) {
    const declared = routine?.declaredFields?.find((field) => field.key === key) ?? {
      key,
      label: CORE_ISSUES[key],
      type: key === "applyUrl" ? FIELD_TYPES.URL : FIELD_TYPES.STRING,
      required: true,
    };
    if (!typeOk(declared, declaredValue(job, key))) issues.push(fieldIssue(declared));
  }
  if (typeof job.id !== "number" || !Number.isFinite(job.id)) issues.push("Job ID");
  if (parseDuplicateWindowDays(job.duplicateWindowDays) !== job.duplicateWindowDays) {
    issues.push("Duplicate window");
  }
  const declared = routine?.declaredFields ?? [];
  for (const field of declared) {
    const value = declaredValue(job, field.key);
    if (isCoreJobFieldKey(field.key) || !isFound(value)) {
      continue;
    }
    if (!typeOk(field, value)) {
      issues.push(fieldIssue(field));
    }
  }
  return issues;
}

export class IncompleteJobDataError extends Error {
  constructor(issues) {
    const uniqueIssues = [...new Set(issues)];
    super(`Skipping job. Missing or invalid required job data: ${uniqueIssues.join(", ")}.`);
    this.name = "IncompleteJobDataError";
    this.issues = uniqueIssues;
  }
}

export function assertCompleteJob(job, routine) {
  const issues = getJobValidationIssues(job, routine);
  if (issues.length) throw new IncompleteJobDataError(issues);
  return job;
}

export { hasText };
