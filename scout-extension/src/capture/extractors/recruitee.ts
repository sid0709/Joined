import { firstAttribute, type PageRoot } from "../page";
import type { ExtractedFields } from "../types";
import { fieldsFromSelectors } from "./fields";

export const RECRUITEE_SELECTORS = {
  title: [".custom-css-style-job-title", ".offer-header h1", ".job-title"],
  company: [".company-name", ".navbar-brand"],
  location: [".custom-css-style-job-location", ".job-location"],
  description: [".custom-css-style-job-description", ".job-description", ".offer-description"],
  applyUrl: ["a.apply-button", "a.custom-css-style-apply-button", 'a[href*="apply"]'],
} as const;

export const RECRUITEE_COMPANY_IMAGE_SELECTORS = [".navbar-brand img", "img.company-logo"] as const;

export function extractRecruitee(root: PageRoot, pageUrl: URL): ExtractedFields {
  const fields = fieldsFromSelectors(root, pageUrl.href, RECRUITEE_SELECTORS);
  if (!fields.company) {
    fields.company = firstAttribute(root, RECRUITEE_COMPANY_IMAGE_SELECTORS, "alt");
  }
  return fields;
}
