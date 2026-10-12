export const EXTRACT_ERROR_TITLE = "Extraction error";

/** Props for the LiveRunCard extraction-error Banner, or null when none. */
export function extractErrorBanner(extractError) {
  if (!extractError) return null;
  return {
    status: "warning",
    title: EXTRACT_ERROR_TITLE,
    description: extractError,
  };
}
