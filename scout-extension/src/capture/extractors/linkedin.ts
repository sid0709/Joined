import type { PageRoot } from "../page";
import type { ExtractedFields } from "../types";
import { fieldsFromSelectors } from "./fields";

export const LINKEDIN_SELECTORS = {
  title: [
    ".jobs-unified-top-card__job-title",
    ".job-details-jobs-unified-top-card__job-title",
    "h1.t-24",
    "h1",
  ],
  company: [
    ".jobs-unified-top-card__company-name",
    ".job-details-jobs-unified-top-card__company-name",
    "a.topcard__org-name-link",
  ],
  location: [
    ".jobs-unified-top-card__bullet",
    ".job-details-jobs-unified-top-card__bullet",
    ".topcard__flavor--bullet",
  ],
  description: ["#job-details", ".jobs-description", ".jobs-box__html-content"],
} as const;

export function extractLinkedIn(root: PageRoot, pageUrl: URL): ExtractedFields {
  return fieldsFromSelectors(root, pageUrl.href, LINKEDIN_SELECTORS);
}
