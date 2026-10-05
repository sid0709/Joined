import type { PageRoot } from "../page";
import type { ExtractedFields } from "../types";
import { fieldsFromSelectors } from "./fields";

export const BAMBOOHR_SELECTORS = {
  title: [".job-posting-title", ".ResAtsJobPosting__title", "#job-title"],
  company: [".company-name", ".ResAtsJobPosting__company"],
  location: [".job-location", ".ResAtsJobPosting__location"],
  description: ["#job-description", ".job-description", ".ResAtsJobPosting__description"],
  applyUrl: ["a.apply-button", "a.ResAtsJobPosting__apply", 'a[href*="apply"]'],
} as const;

export function extractBambooHr(root: PageRoot, pageUrl: URL): ExtractedFields {
  return fieldsFromSelectors(root, pageUrl.href, BAMBOOHR_SELECTORS);
}
