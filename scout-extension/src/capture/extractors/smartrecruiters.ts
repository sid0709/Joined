import type { PageRoot } from "../page";
import type { ExtractedFields } from "../types";
import { fieldsFromSelectors } from "./fields";

export const SMARTRECRUITERS_SELECTORS = {
  title: ['[data-test="job-title"]', "h1.job-title", ".job-title"],
  company: ['[data-test="job-company"]', ".job-details-company", ".company-name"],
  location: ['[data-test="job-location"]', ".job-details-location", ".job-location"],
  description: ["#st-jobDescription", ".jobad-content", '[data-test="job-description"]'],
  applyUrl: ['a[data-test="apply-button"]', "a.button--apply", 'a[href*="apply"]'],
} as const;

export function extractSmartRecruiters(root: PageRoot, pageUrl: URL): ExtractedFields {
  return fieldsFromSelectors(root, pageUrl.href, SMARTRECRUITERS_SELECTORS);
}
