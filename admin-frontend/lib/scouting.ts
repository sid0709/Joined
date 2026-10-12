import type { AdminSubmission, Check, SubmissionStatus } from "@joined/scout";

export const QUEUE_PAGE_SIZE = 25;
export const SCOUTS_PAGE_SIZE = 25;
export const PAYOUTS_PAGE_SIZE = 25;
const SUBMISSIONS_PATH = "/v1/admin/scout/submissions";
const SCOUTS_PATH = "/v1/admin/scout/scouts";
const PAYOUTS_PATH = "/v1/admin/scout/payouts";
export const SCOUT_OVERVIEW_PATH = "/v1/admin/scout/overview";
export const PAYOUT_REQUESTED = "requested";
const PAYOUT_STATUSES = ["requested", "paid", "rejected", "all"] as const;
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

export function submissionsPath(next: {
  status: QueueFilter;
  q: string;
  channel: string;
  page: number;
}) {
  const search = new URLSearchParams({
    page: String(next.page),
    page_size: String(QUEUE_PAGE_SIZE),
  });
  if (next.status) search.set("status", next.status);
  if (next.q) search.set("q", next.q);
  if (next.channel) search.set("channel", next.channel);
  return `${SUBMISSIONS_PATH}?${search}`;
}

export function scoutsPath(next: { verification: string; level: string; q: string; page: number }) {
  const search = new URLSearchParams({
    page: String(next.page),
    page_size: String(SCOUTS_PAGE_SIZE),
  });
  if (next.verification) search.set("verification", next.verification);
  if (next.level) search.set("level", next.level);
  if (next.q) search.set("q", next.q);
  return `${SCOUTS_PATH}?${search}`;
}

/** Named payout tabs stay. Anything else is the default "to pay" list. */
export function payoutListStatus(value: string | null | undefined) {
  const status = value ?? "";
  return (PAYOUT_STATUSES as readonly string[]).includes(status) ? status : PAYOUT_REQUESTED;
}

export function payoutsPath(status: string, page: number) {
  const search = new URLSearchParams({
    page: String(page),
    page_size: String(PAYOUTS_PAGE_SIZE),
  });
  if (status !== "all") search.set("status", status);
  return `${PAYOUTS_PATH}?${search}`;
}

/** Rows whose checks flagged something, for the "why is this here" column. */
export function flagSummary(row: Pick<AdminSubmission, "auto_check_results">) {
  const flagged = attentionChecks(row.auto_check_results);
  return flagged.length === 0
    ? "All checks passed"
    : flagged.map((check) => check.label).join(" · ");
}
