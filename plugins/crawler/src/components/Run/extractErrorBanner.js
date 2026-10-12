import { MARK_APPLIED_LABEL } from "../../routines/hiringcafe/constants";

export const EXTRACT_ERROR_TITLE = "Extraction error";

/** Props for the LiveRunCard extraction-error Banner, or null when none. */
export function extractErrorBanner(extractError) {
  if (!extractError) return null;
  const title = /not marked applied/i.test(String(extractError))
    ? MARK_APPLIED_LABEL
    : EXTRACT_ERROR_TITLE;
  return {
    status: "warning",
    title,
    description: extractError,
  };
}
