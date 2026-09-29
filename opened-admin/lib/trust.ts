/**
 * Staff trust queues for company mode. Paths follow docs/32 for cases.
 * Direct-job review is provisional until Einstein publishes the admin job contract.
 * The browser calls these through the admin proxy, which attaches X-Admin-Actor.
 */

export const CASES_PATH = "/v1/admin/cases";
export const ADMIN_JOBS_PATH = "/v1/admin/jobs";

export const COMPANY_VERIFICATION_QUEUE = "company_verification";
export const CASE_STATUS_PENDING = "pending";
export const DIRECT_JOB_SOURCE = "direct";
export const DIRECT_JOB_PENDING = "pending_review";
export const TRUST_PAGE_SIZE = 25;

export const CASE_STATUSES = [
  { value: CASE_STATUS_PENDING, label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
  { value: "", label: "All" },
] as const;

export const DIRECT_JOB_STATUSES = [
  { value: DIRECT_JOB_PENDING, label: "Pending review" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "removed", label: "Removed" },
  { value: "", label: "All direct" },
] as const;

export const JOB_REJECT_DISPOSITIONS = [
  { value: "removed", label: "Removed" },
  { value: "draft", label: "Draft" },
] as const;

export type CaseDecision = "approve" | "reject" | "suspend";
export type JobReviewDecision = "approve" | "reject";
export type JobTakedownDecision = "takedown" | "restore";
export type JobDisposition = "active" | "removed" | "draft";

export type CaseDecisionBody = {
  decision: CaseDecision;
  reason: string;
  actions: string[];
};

export type JobReviewBody = {
  decision: JobReviewDecision;
  disposition: JobDisposition;
  reason: string;
};

export type JobTakedownBody = {
  decision: JobTakedownDecision;
  disposition: "removed" | "active";
  reason: string;
};

export type TrustCompany = {
  id: string;
  name: string;
  domain: string;
  status: string;
};

export type TrustMember = {
  id: string;
  email: string;
  role: string;
  status: string;
};

export type TrustCase = {
  id: string;
  queue: string;
  status: string;
  createdAt: string;
  domain: string;
  claimMethod: string;
  company: TrustCompany | null;
  members: TrustMember[];
  title: string;
};

export type DirectJob = {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  source: string;
  status: string;
  applyUrl: string;
  postedAt: string;
};

export type ReadList<T> = {
  rows: T[];
  total: number;
  recognized: boolean;
};

export type TrustNavCounts = {
  companyVerification?: number;
  directReview?: number;
};

const CLAIM_METHODS: Record<string, string> = {
  domain_email: "Work email",
  dns_txt: "DNS TXT",
  manual: "Manual",
};

const MISSING_STATUSES = new Set([404, 405, 501]);

export function claimMethodLabel(method: string) {
  if (!method) return "—";
  return CLAIM_METHODS[method] ?? method;
}

export function caseStatus(value: string | null | undefined) {
  if (value === "all") return "";
  return CASE_STATUSES.some((item) => item.value === value) ? value || "" : CASE_STATUS_PENDING;
}

export function directJobStatus(value: string | null | undefined) {
  if (value === "all") return "";
  return DIRECT_JOB_STATUSES.some((item) => item.value === value)
    ? value || ""
    : DIRECT_JOB_PENDING;
}

export function companyCasesPath(status: string, page: number, pageSize = TRUST_PAGE_SIZE) {
  const params = new URLSearchParams({
    queue: COMPANY_VERIFICATION_QUEUE,
    page: String(page),
    page_size: String(pageSize),
  });
  if (status) params.set("status", status);
  return `${CASES_PATH}?${params}`;
}

export function casePath(id: string) {
  return `${CASES_PATH}/${encodeURIComponent(id)}`;
}

export function caseDecisionPath(id: string) {
  return `${casePath(id)}/decision`;
}

export function directJobsPath(status: string, page: number, pageSize = TRUST_PAGE_SIZE) {
  const params = new URLSearchParams({
    source: DIRECT_JOB_SOURCE,
    page: String(page),
    page_size: String(pageSize),
  });
  if (status) params.set("status", status);
  return `${ADMIN_JOBS_PATH}?${params}`;
}

export function directJobPath(id: string) {
  return `${ADMIN_JOBS_PATH}/${encodeURIComponent(id)}`;
}

export function jobReviewPath(id: string) {
  return `${directJobPath(id)}/review`;
}

export function jobTakedownPath(id: string) {
  return `${directJobPath(id)}/takedown`;
}

export function caseListQuery(status: string, page: number) {
  const params = new URLSearchParams();
  if (status !== CASE_STATUS_PENDING) params.set("status", status || "all");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function directJobListQuery(status: string, page: number) {
  const params = new URLSearchParams();
  if (status !== DIRECT_JOB_PENDING) params.set("status", status || "all");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** A decision cannot be sent until the reviewer writes a reason. */
export function requireReason(reason: string) {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("Reason is required.");
  return trimmed;
}

export function caseDecisionBody(decision: CaseDecision, reason: string): CaseDecisionBody {
  return { decision, reason: requireReason(reason), actions: [] };
}

export function jobReviewBody(
  decision: JobReviewDecision,
  reason: string,
  disposition?: string,
): JobReviewBody {
  const text = requireReason(reason);
  if (decision === "approve") return { decision, disposition: "active", reason: text };
  if (disposition !== "removed" && disposition !== "draft") {
    throw new Error("Choose removed or draft.");
  }
  return { decision, disposition, reason: text };
}

export function jobTakedownBody(decision: JobTakedownDecision, reason: string): JobTakedownBody {
  return {
    decision,
    disposition: decision === "takedown" ? "removed" : "active",
    reason: requireReason(reason),
  };
}

export function trustLoadError(status: number | null, message: string | null) {
  if (status !== null && MISSING_STATUSES.has(status)) {
    return "This staff endpoint is not on the API yet. The queue stays empty until it is live.";
  }
  return message || "Could not load.";
}

export function readCaseList(body: unknown): ReadList<TrustCase> {
  return readRows(body, ["data", "cases", "items"], readTrustCase);
}

export function readCaseDetail(body: unknown): TrustCase | null {
  const row = asRecord(body);
  if (!row) return null;
  const nested = row.case ?? row.data;
  if (nested && !Array.isArray(nested)) return readTrustCase(nested);
  return readTrustCase(body);
}

export function readDirectJobList(body: unknown): ReadList<DirectJob> {
  return readRows(body, ["data", "jobs", "items"], readDirectJob);
}

export function readDirectJobDetail(body: unknown): DirectJob | null {
  const row = asRecord(body);
  if (!row) return null;
  const data = row.data;
  if (data && !Array.isArray(data) && !text(row.id) && !asRecord(row.job)) {
    return readDirectJob(data);
  }
  return readDirectJob(body);
}

function readRows<T extends { id: string }>(
  body: unknown,
  keys: string[],
  read: (value: unknown) => T | null,
): ReadList<T> {
  const source = Array.isArray(body) ? body : arrayField(body, keys);
  if (!source) return { rows: [], total: 0, recognized: false };
  const rows = source.map(read).filter((item): item is T => item !== null);
  if (source.length > 0 && rows.length === 0) return { rows: [], total: 0, recognized: false };
  return { rows, total: readTotal(body, rows.length), recognized: true };
}

export function readTrustCase(value: unknown): TrustCase | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = text(row.id);
  if (!id) return null;
  const claim = asRecord(row.claim);
  const company = readCompany(row.company ?? row.linked_company ?? claim?.company);
  const domain = text(row.domain, row.primary_domain, claim?.domain, company?.domain);
  const claimMethod = text(row.claim_method, row.claimMethod, claim?.method);
  const name = text(company?.name, row.company_name, row.subject);
  return {
    id,
    queue: text(row.queue),
    status: text(row.status) || CASE_STATUS_PENDING,
    createdAt: text(row.created_at, row.createdAt),
    domain,
    claimMethod,
    company,
    members: readMembers(row.members ?? claim?.members),
    title: name || domain || "Verification case",
  };
}

export function readDirectJob(value: unknown): DirectJob | null {
  const row = asRecord(value);
  if (!row) return null;
  const job = asRecord(row.job);
  const id = text(row.id, job?.id);
  if (!id) return null;
  const company = asRecord(row.company);
  return {
    id,
    title: text(row.title, job?.title) || "Untitled job",
    companyId: text(row.company_id, row.companyId, job?.companyId, job?.company_id, company?.id),
    companyName: text(
      row.company_name,
      row.companyName,
      company?.name,
      job?.company,
      job?.companyName,
    ),
    source: text(row.source, job?.source),
    status: text(row.status, job?.status),
    applyUrl: text(
      row.official_apply_url,
      row.apply_url,
      row.applyUrl,
      row.applyLink,
      job?.applyLink,
    ),
    postedAt: text(row.posted_at, row.postedAt, job?.postedAt),
  };
}

function readCompany(value: unknown): TrustCompany | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = text(row.id);
  const name = text(row.name, row.legal_name);
  const domain = text(row.primary_domain, row.domain, row.url);
  if (!id && !name && !domain) return null;
  return { id, name, domain, status: text(row.status) };
}

function readMembers(value: unknown): TrustMember[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const email = text(row.email, row.user_email);
    const id = text(row.user_id, row.userId, row.id, email);
    if (!id && !email) return [];
    return [{ id, email, role: text(row.role), status: text(row.status) }];
  });
}

function arrayField(body: unknown, keys: string[]) {
  const row = asRecord(body);
  if (!row) return null;
  for (const key of keys) {
    if (Array.isArray(row[key])) return row[key];
  }
  return null;
}

function readTotal(body: unknown, fallback: number) {
  const row = asRecord(body);
  const total = row?.total;
  return typeof total === "number" && Number.isFinite(total) ? total : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
