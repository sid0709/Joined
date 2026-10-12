import { MARK_APPLIED_LABEL, markedReasonsLabel } from "../../routines/hiringcafe/constants";

export const EXTRACT_ERROR_TITLE = "Extraction error";

/** Props for the LiveRunCard extraction-error Banner, or null when none. */
export function extractErrorBanner(extractError, markReasons = []) {
  const reasons = markedReasonsLabel(markReasons);
  const message = String(extractError || "").trim();
  if (!reasons && !message) return null;
  const isMark = Boolean(reasons) || /not marked applied/i.test(message);
  const description = [...new Set([reasons, message].filter(Boolean))].join(" · ");
  return {
    status: "warning",
    title: isMark ? MARK_APPLIED_LABEL : EXTRACT_ERROR_TITLE,
    description,
  };
}
