import { firstHref, firstMultiline, firstText, type PageRoot } from "../page";
import type { ExtractedFields } from "../types";

export interface FieldSelectors {
  title: readonly string[];
  company: readonly string[];
  location: readonly string[];
  description: readonly string[];
  applyUrl?: readonly string[];
}

export function fieldsFromSelectors(
  root: PageRoot,
  pageUrl: string,
  selectors: FieldSelectors,
): ExtractedFields {
  return {
    title: firstText(root, selectors.title),
    company: firstText(root, selectors.company),
    location: firstText(root, selectors.location),
    description: firstMultiline(root, selectors.description),
    applyUrl: (selectors.applyUrl && firstHref(root, selectors.applyUrl, pageUrl)) || pageUrl,
  };
}
