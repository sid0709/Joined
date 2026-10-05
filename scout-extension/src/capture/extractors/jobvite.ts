import { firstAttribute, type PageRoot } from "../page";
import type { ExtractedFields } from "../types";
import { fieldsFromSelectors } from "./fields";

export const JOBVITE_SELECTORS = {
  title: [".jv-header-title", ".jv-job-detail-name", "h2.jv-header"],
  company: [".jv-company-name", ".company-name"],
  location: [".jv-job-detail-location", ".jv-job-detail-meta"],
  description: [".jv-job-detail-description", ".jv-job-detail"],
  applyUrl: ["a.jv-button-apply", 'a[href*="apply"]'],
} as const;

export const JOBVITE_COMPANY_IMAGE_SELECTORS = [".jv-logo img", "img.jv-logo"] as const;

export function extractJobvite(root: PageRoot, pageUrl: URL): ExtractedFields {
  const fields = fieldsFromSelectors(root, pageUrl.href, JOBVITE_SELECTORS);
  if (!fields.company) {
    fields.company = firstAttribute(root, JOBVITE_COMPANY_IMAGE_SELECTORS, "alt");
  }
  return fields;
}
