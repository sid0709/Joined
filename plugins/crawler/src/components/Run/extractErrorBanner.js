import { MARK_APPLIED_LABEL, markedReasonsLabel } from "../../routines/hiringcafe/constants";

export const EXTRACT_ERROR_TITLE = "Extraction error";

function uniqueLogs(values) {
  return [
    ...new Set(
      (values ?? [])
        .flatMap((value) => String(value || "").split("\n"))
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

/** Props for the LiveRunCard extraction-error Banner, or null when none. */
export function extractErrorBanner(extractError, markReasons = [], markLogs = []) {
  const logs = uniqueLogs([...(markLogs ?? []), extractError]);
  const reasons = markedReasonsLabel(markReasons);
  if (!logs.length && !reasons) return null;
  const isMark = Boolean(reasons) || logs.some((log) => /not marked applied/i.test(log));
  return {
    status: "warning",
    title: isMark ? MARK_APPLIED_LABEL : EXTRACT_ERROR_TITLE,
    description: logs.length ? logs.join(" · ") : reasons,
  };
}
