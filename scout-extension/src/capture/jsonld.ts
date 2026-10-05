import { firstText, stripHtml, type PageRoot } from "./page";
import type { ExtractedFields } from "./types";

export const JSON_LD_SCRIPT_SELECTOR = 'script[type="application/ld+json"]';
export const JOB_POSTING_TYPE = "JobPosting";
export const TELECOMMUTE_LOCATION_TYPE = "TELECOMMUTE";
export const REMOTE_LOCATION_LABEL = "Remote";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function typeValues(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  return [];
}

function hasJobPostingType(value: unknown): boolean {
  return typeValues(isRecord(value) ? value["@type"] : undefined).includes(JOB_POSTING_TYPE);
}

export function parseJsonLdText(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function findJobPosting(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findJobPosting(entry);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }
  if (hasJobPostingType(value)) {
    return value;
  }
  if ("@graph" in value) {
    return findJobPosting(value["@graph"]);
  }
  return null;
}

function organizationName(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (isRecord(value)) {
    return asString(value.name);
  }
  return "";
}

function formatAddress(address: unknown): string {
  if (typeof address === "string") {
    return address.trim();
  }
  if (!isRecord(address)) {
    return "";
  }
  return [address.addressLocality, address.addressRegion, address.addressCountry]
    .map(asString)
    .filter(Boolean)
    .join(", ");
}

function locationFromPlace(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (!isRecord(value)) {
    return "";
  }
  return formatAddress(value.address) || asString(value.name);
}

export function jobLocationText(job: Record<string, unknown>): string {
  const places = Array.isArray(job.jobLocation) ? job.jobLocation : [job.jobLocation];
  const fromPlaces = places.map(locationFromPlace).filter(Boolean);
  if (fromPlaces.length > 0) {
    return [...new Set(fromPlaces)].join("; ");
  }
  if (asString(job.jobLocationType).toUpperCase() === TELECOMMUTE_LOCATION_TYPE) {
    return REMOTE_LOCATION_LABEL;
  }
  return locationFromPlace(job.applicantLocationRequirements);
}

export function jobPostingToFields(job: Record<string, unknown>): ExtractedFields {
  return {
    title: asString(job.title),
    company: organizationName(job.hiringOrganization),
    location: jobLocationText(job),
    applyUrl: asString(job.url) || asString(job.applicationUrl),
    description: stripHtml(asString(job.description)),
  };
}

export function extractJsonLdJob(root: PageRoot): ExtractedFields | null {
  const scripts = Array.from(root.querySelectorAll(JSON_LD_SCRIPT_SELECTOR));
  for (const script of scripts) {
    const posting = findJobPosting(parseJsonLdText(script.textContent ?? ""));
    if (posting) {
      return jobPostingToFields(posting);
    }
  }
  const fallbackText = firstText(root, [JSON_LD_SCRIPT_SELECTOR]);
  if (!fallbackText) {
    return null;
  }
  const posting = findJobPosting(parseJsonLdText(fallbackText));
  return posting ? jobPostingToFields(posting) : null;
}
