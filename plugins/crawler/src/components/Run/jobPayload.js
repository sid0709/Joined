import { DUPLICATE_WINDOW_DAYS, SCRAPE_SOURCE } from "../../config/env";
import { CORE_JOB_FIELD_KEYS } from "../../routineKit/declaredFields";
import { isFound } from "../../routineKit/html.js";

const CORE_KEY_SET = new Set(CORE_JOB_FIELD_KEYS);
const ENVELOPE_KEYS = new Set([
  "createdBy",
  "source",
  "id",
  "duplicateWindowDays",
  "meta",
  "metadata",
  "company",
  "details",
  "applyLink",
  "companyLink",
  "postedAt",
  "postedAgo",
  "tags",
  "skills",
  "applicants",
]);

const DETAIL_KEYS = {
  location: "location",
  workMode: "remote",
  employmentType: "time",
  seniority: "seniority",
  salary: "salary",
};

const COMPANY_EXTRA_KEYS = {
  companyWebsite: "website",
  companySize: "size",
  companyHq: "hq",
  companyFounded: "founded",
  companyAbout: "about",
  companySocial: "social",
};

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function metadataFrom(record) {
  const metadata = isRecord(record.metadata) ? { ...record.metadata } : {};
  for (const [key, value] of Object.entries(record ?? {})) {
    if (CORE_KEY_SET.has(key) || ENVELOPE_KEYS.has(key)) continue;
    metadata[key] = value;
  }
  return metadata;
}

function detailsFrom(record) {
  const details = isRecord(record?.details) ? { ...record.details } : {};
  for (const [from, to] of Object.entries(DETAIL_KEYS)) {
    if (isFound(details[to])) continue;
    const value = record?.[from];
    if (isFound(value)) details[to] = String(value).trim();
  }
  return details;
}

function companyFrom(record) {
  const nested = isRecord(record?.company) ? record.company : {};
  const company = {
    name: record?.companyName || nested.name || "",
  };
  const logo = record?.companyLogo || nested.logo || "";
  if (isFound(logo)) company.logo = logo;
  for (const [from, to] of Object.entries(COMPANY_EXTRA_KEYS)) {
    const value = record?.[from] ?? nested[to];
    if (isFound(value)) company[to] = value;
  }
  return company;
}

/**
 * A job routine's record as the admin API's crawler ingest expects: applyLink,
 * company.name, analyzer details, and the rest in metadata.
 */
export function toJobPayload(record, routine) {
  const metadata = metadataFrom(record ?? {});
  const company = companyFrom(record ?? {});
  const applicantCount = record?.applicantCount;
  const payload = {
    applyLink: record?.applyUrl || record?.applyLink || "",
    title: record?.title || "",
    description: record?.description || "",
    company,
    companyLink: company.website || record?.companyWebsite || "",
    details: detailsFrom(record ?? {}),
    metadata,
    createdBy: SCRAPE_SOURCE,
    source: routine?.id ?? "",
    id: Date.now(),
    duplicateWindowDays: DUPLICATE_WINDOW_DAYS,
  };
  if (isFound(record?.postedAt)) payload.postedAt = record.postedAt;
  if (isFound(record?.postedAgo)) payload.postedAgo = record.postedAgo;
  if (Array.isArray(record?.badges) && record.badges.length) payload.tags = record.badges;
  if (Array.isArray(record?.skills) && record.skills.length) payload.skills = record.skills;
  if (typeof applicantCount === "number" && Number.isFinite(applicantCount)) {
    payload.applicants = { count: applicantCount };
  }
  return payload;
}
