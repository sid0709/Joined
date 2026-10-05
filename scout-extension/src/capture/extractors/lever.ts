import { firstAttribute, type PageRoot } from "../page";
import type { ExtractedFields } from "../types";
import { fieldsFromSelectors } from "./fields";

export const LEVER_SELECTORS = {
  title: [".posting-headline h2", "h2.posting-name", "h2"],
  company: [".main-header-text a"],
  location: [".posting-categories .location", ".location"],
  description: [".section-wrapper", '[data-qa="job-description"]', ".posting-page"],
} as const;

export const LEVER_COMPANY_IMAGE_SELECTORS = [
  ".main-header-logo img",
  "img.main-header-logo",
] as const;

export function extractLever(root: PageRoot, pageUrl: URL): ExtractedFields {
  const fields = fieldsFromSelectors(root, pageUrl.href, LEVER_SELECTORS);
  if (!fields.company) {
    fields.company = firstAttribute(root, LEVER_COMPANY_IMAGE_SELECTORS, "alt");
  }
  return fields;
}
