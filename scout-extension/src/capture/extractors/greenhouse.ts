import type { PageRoot } from "../page";
import type { ExtractedFields } from "../types";
import { fieldsFromSelectors } from "./fields";

export const GREENHOUSE_SELECTORS = {
  title: ["h1.app-title", ".app-title", "#header h1", "h1"],
  company: [".company-name", "#header .company-name"],
  location: [".location", "#header .location", ".job-location"],
  description: ["#content .content", "#content", "#app_body", ".job__description"],
  applyUrl: ["a#apply_button", 'a[href*="/apply"]'],
} as const;

export function extractGreenhouse(root: PageRoot, pageUrl: URL): ExtractedFields {
  return fieldsFromSelectors(root, pageUrl.href, GREENHOUSE_SELECTORS);
}
