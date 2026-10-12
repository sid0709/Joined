import { isFound } from "../../routineKit/html.js";

import { parseFromDom, jobInfoUrlFrom } from "./parseDom.js";
import { hasNextDataJob, parseFromNextData } from "./parseNextData.js";
import { firstFound } from "./values.js";

const MERGE_KEYS = [
  "applyUrl",
  "title",
  "description",
  "companyName",
  "location",
  "workMode",
  "employmentType",
  "seniority",
  "yearsOfExperience",
  "salary",
  "postedAt",
  "applicantCount",
  "badges",
  "industryTags",
  "benefits",
  "skills",
  "descriptionSections",
  "originalPostUrl",
  "companyLogo",
  "companyWebsite",
  "companySize",
  "companyHq",
  "companyFounded",
  "companyAbout",
  "companySocial",
];

function mergeRecords(preferred, fallback) {
  const record = {};
  for (const key of MERGE_KEYS) {
    record[key] = firstFound(preferred?.[key], fallback?.[key]);
  }
  return record;
}

function hasCore(record) {
  return Boolean(
    isFound(record?.applyUrl) &&
    isFound(record?.title) &&
    isFound(record?.description) &&
    isFound(record?.companyName),
  );
}

/**
 * JobRight detail: prefer `#__NEXT_DATA__` jobResult/companyResult, fill gaps from the DOM.
 */
export function parseDetail(html, pageUrl = "", extras = {}) {
  const fromJson = parseFromNextData(html);
  const fromDom = parseFromDom(html, pageUrl);
  const merged = fromJson ? mergeRecords(fromJson, fromDom) : fromDom;
  if (!isFound(merged.salary) && isFound(extras.salary)) merged.salary = extras.salary;
  return merged;
}

export function parseDetailNeedsFetch(html) {
  return !hasNextDataJob(html);
}

export { jobInfoUrlFrom, hasCore };
