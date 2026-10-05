import type { PageRoot } from "../page";
import type { ExtractedFields } from "../types";
import { fieldsFromSelectors } from "./fields";

export const WORKABLE_SELECTORS = {
  title: ['[data-ui="job-title"]'],
  company: ['[data-ui="company-name"]', ".company-name"],
  location: ['[data-ui="job-location"]'],
  description: ['[data-ui="job-description"]', "#job-description"],
  applyUrl: ['a[data-ui="apply-button"]', 'a[href*="apply"]'],
} as const;

export function extractWorkable(root: PageRoot, pageUrl: URL): ExtractedFields {
  return fieldsFromSelectors(root, pageUrl.href, WORKABLE_SELECTORS);
}
