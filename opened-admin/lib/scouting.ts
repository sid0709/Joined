import type { AdminSubmission, Check, SubmissionStatus } from "@openseat/scout";

export const QUEUE_PAGE_SIZE = 25;
export const SCOUTS_PAGE_SIZE = 25;
export const PAYOUTS_PAGE_SIZE = 25;
/** Rows of the queue shown on the overview. */
export const OVERVIEW_QUEUE_ROWS = 8;

/** Queue filters; "expired" is an approved job that closed. */
export type QueueFilter = SubmissionStatus | "expired" | "";

export const QUEUE_FILTERS: { value: QueueFilter; label: string }[] = [
  { value: "needs_review", label: "Needs review" },
  { value: "auto_checking", label: "Checking" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "duplicate", label: "Duplicate" },
  { value: "expired", label: "Expired" },
  { value: "", label: "All" },
];

export function queueFilter(value: string | null | undefined): QueueFilter {
  if (value === "all") return "";
  return QUEUE_FILTERS.find((item) => item.value === value)?.value ?? "needs_review";
}

/** The checks a moderator should look at first: failures, then reviews and flags. */
export function attentionChecks(checks: Check[]): Check[] {
  const rank = { fail: 0, review: 1, flag: 2, pass: 3 } as const;
  return checks
    .filter((check) => check.outcome !== "pass")
    .sort((a, b) => rank[a.outcome] - rank[b.outcome]);
}

/** Query string for the queue, leaving defaults out of the URL. */
export function queueQuery(next: {
  status: QueueFilter;
  q: string;
  channel: string;
  page: number;
}) {
  const params = new URLSearchParams();
  if (next.status !== "needs_review") params.set("status", next.status || "all");
  if (next.q) params.set("q", next.q);
  if (next.channel) params.set("channel", next.channel);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Rows whose checks flagged something, for the "why is this here" column. */
export function flagSummary(row: Pick<AdminSubmission, "auto_check_results">) {
  const flagged = attentionChecks(row.auto_check_results);
  return flagged.length === 0
    ? "All checks passed"
    : flagged.map((check) => check.label).join(" · ");
}
