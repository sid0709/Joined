import type { PageRoot } from "../page";
import type { ExtractedFields } from "../types";
import { fieldsFromSelectors } from "./fields";

export const ICIMS_SELECTORS = {
  title: ["h1.iCIMS_Header", ".iCIMS_Header", '[itemprop="title"]'],
  company: ['[itemprop="hiringOrganization"]', ".iCIMS_CompanyName", ".company-name"],
  location: [
    ".iCIMS_JobHeaderField",
    '[itemprop="jobLocation"]',
    ".iCIMS_JobHeaderGroup .iCIMS_JobHeaderData",
  ],
  description: [".iCIMS_JobContent", "#job-description", '[itemprop="description"]'],
  applyUrl: ["a.iCIMS_ApplyOnlineButton", "a.iCIMS_Anchor", 'a[href*="apply"]'],
} as const;

export function extractIcims(root: PageRoot, pageUrl: URL): ExtractedFields {
  return fieldsFromSelectors(root, pageUrl.href, ICIMS_SELECTORS);
}
