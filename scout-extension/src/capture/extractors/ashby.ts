import type { PageRoot } from "../page";
import type { ExtractedFields } from "../types";
import { fieldsFromSelectors } from "./fields";

export const ASHBY_SELECTORS = {
  title: ['[class*="ashby-job-posting-heading"]', "h1"],
  company: ['[class*="ashby-job-posting-header"] a'],
  location: ['[class*="ashby-job-posting-location"]'],
  description: ['[class*="ashby-job-posting-body"]', "#overview"],
} as const;

export function extractAshby(root: PageRoot, pageUrl: URL): ExtractedFields {
  return fieldsFromSelectors(root, pageUrl.href, ASHBY_SELECTORS);
}
