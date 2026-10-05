import type { PageRoot } from "../page";
import type { ExtractedFields } from "../types";
import { fieldsFromSelectors } from "./fields";

export const WORKDAY_SELECTORS = {
  title: ['[data-automation-id="jobPostingHeader"]', "h2"],
  company: ['[data-automation-id="company"]'],
  location: ['[data-automation-id="locations"]', '[data-automation-id="location"]'],
  description: ['[data-automation-id="jobPostingDescription"]'],
} as const;

export function extractWorkday(root: PageRoot, pageUrl: URL): ExtractedFields {
  return fieldsFromSelectors(root, pageUrl.href, WORKDAY_SELECTORS);
}
