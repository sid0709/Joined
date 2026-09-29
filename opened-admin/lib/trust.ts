/**
 * Staff trust clients for company mode. Shapes are Einstein's locked admin
 * contract (camelCase). Calls go through the admin proxy, which sends
 * Authorization and X-Admin-Actor. There is no /v1/admin/cases queue.
 */

export const ADMIN_COMPANIES_PATH = "/v1/admin/companies";
export const VERIFICATIONS_PATH = "/v1/admin/companies/verifications";
export const VERIFICATION_PENDING_COUNT_PATH = "/v1/admin/companies/verifications/pending-count";
export const ADMIN_JOBS_PATH = "/v1/admin/jobs";

export const VERIFICATION_PENDING = "pending";
export const DIRECT_JOB_SOURCE = "direct";
export const DIRECT_JOB_PENDING = "pending_review";
export const TRUST_PAGE_SIZE = 25;

export const VERIFICATION_STATUSES = [
  { value: VERIFICATION_PENDING, label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
] as const;

export const JOB_REJECT_DISPOSITIONS = [
  { value: "removed", label: "Removed" },
  { value: "draft", label: "Draft" },
] as const;

export type VerificationDecision = "approve" | "reject" | "suspend";
export type JobReviewDecision = "approve" | "reject";
export type RejectDisposition = "removed" | "draft";

export type VerifyCompanyBody = {
  decision: VerificationDecision;
  reason: string;
};

export type JobReviewBody =
  | { decision: "approve"; reason?: string }
  | { decision: "reject"; reason?: string; rejectDisposition: RejectDisposition };

export type JobTakedownBody = { reason: string };

export type VerificationRow = {
  id: string;
  companyId: string;
  companyName: string;
  claimMethod: string;
  requestedBy: string;
  domains: string[];
  memberCount: number;
  status: string;
  createdAt: string;
  slaAt: string;
};

export type CompanyDomain = { domain: string; verified: boolean };

export type CompanyMember = {
  userId: string;
  email: string;
  role: string;
  createdAt: string;
};

export type PendingClaim = {
  id: string;
  method: string;
  requestedBy: string;
  createdAt: string;
};

export type VerificationAudit = {
  at: string;
  actor: string;
  action: string;
  reason: string;
};

/** GET /v1/admin/companies/{id}. */
export type CompanyVerification = {
  id: string;
  name: string;
  url: string;
  logo: string;
  primaryDomain: string;
  domains: CompanyDomain[];
  members: CompanyMember[];
  claimMethod: string;
  claimed: boolean;
  verificationStatus: string;
  pendingClaim: PendingClaim | null;
  verifiedAt: string;
  suspendedAt: string;
  audit: VerificationAudit[];
};

/** A row from GET /v1/admin/jobs and the job inside review/takedown responses. */
export type AdminDirectJob = {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  source: string;
  status: string;
  postedAt: string;
  createdAt: string;
  location: string;
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

export function verificationListStatus(value: string | null | undefined) {
  return VERIFICATION_STATUSES.some((item) => item.value === value)
    ? (value as (typeof VERIFICATION_STATUSES)[number]["value"])
    : VERIFICATION_PENDING;
}

export function verificationsPath(status: string, page: number, pageSize = TRUST_PAGE_SIZE) {
  const params = new URLSearchParams({
    status: verificationListStatus(status),
    page: String(page),
    pageSize: String(pageSize),
  });
  return `${VERIFICATIONS_PATH}?${params}`;
}

export function adminCompanyPath(id: string) {
  return `${ADMIN_COMPANIES_PATH}/${encodeURIComponent(id)}`;
}

export function verifyCompanyPath(id: string) {
  return `${adminCompanyPath(id)}/verify`;
}

export function directJobsPath(page: number, pageSize = TRUST_PAGE_SIZE) {
  const params = new URLSearchParams({
    source: DIRECT_JOB_SOURCE,
    status: DIRECT_JOB_PENDING,
    page: String(page),
    pageSize: String(pageSize),
  });
  return `${ADMIN_JOBS_PATH}?${params}`;
}

export function jobReviewPath(id: string) {
  return `${ADMIN_JOBS_PATH}/${encodeURIComponent(id)}/review`;
}

export function jobTakedownPath(id: string) {
  return `${ADMIN_JOBS_PATH}/${encodeURIComponent(id)}/takedown`;
}

export function verificationListQuery(status: string, page: number) {
  const params = new URLSearchParams();
  if (status !== VERIFICATION_PENDING) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Verify and take-down reject an empty reason. Review may omit it. */
export function requireReason(reason: string) {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("Reason is required.");
  return trimmed;
}

export function verifyCompanyBody(
  decision: VerificationDecision,
  reason: string,
): VerifyCompanyBody {
  return { decision, reason: requireReason(reason) };
}

export function jobReviewBody(
  decision: JobReviewDecision,
  reason: string,
  rejectDisposition?: string,
): JobReviewBody {
  const text = reason.trim();
  if (decision === "approve") {
    return text ? { decision: "approve", reason: text } : { decision: "approve" };
  }
  if (rejectDisposition !== "removed" && rejectDisposition !== "draft") {
    throw new Error("Choose removed or draft.");
  }
  return text
    ? { decision: "reject", reason: text, rejectDisposition }
    : { decision: "reject", rejectDisposition };
}

export function jobTakedownBody(reason: string): JobTakedownBody {
  return { reason: requireReason(reason) };
}

export function trustLoadError(status: number | null, message: string | null) {
  if (status !== null && MISSING_STATUSES.has(status)) {
    return "This staff endpoint is not on the API yet. The queue stays empty until it is live.";
  }
  return message || "Could not load.";
}

export function readVerificationList(body: unknown): ReadList<VerificationRow> {
  const data = asRecord(body)?.data;
  if (!Array.isArray(data)) return { rows: [], total: 0, recognized: false };
  const rows = data
    .map(readVerificationRow)
    .filter((item): item is VerificationRow => item !== null);
  if (data.length > 0 && rows.length === 0) return { rows: [], total: 0, recognized: false };
  return { rows, total: readTotal(body, rows.length), recognized: true };
}

export function readPendingCount(body: unknown) {
  const pending = asRecord(body)?.pending;
  return typeof pending === "number" && Number.isFinite(pending) ? pending : null;
}

export function readCompanyVerification(body: unknown): CompanyVerification | null {
  const row = asRecord(body);
  if (!row) return null;
  const id = text(row.id);
  if (!id) return null;
  return {
    id,
    name: text(row.name),
    url: text(row.url),
    logo: text(row.logo),
    primaryDomain: text(row.primaryDomain),
    domains: readDomains(row.domains),
    members: readMembers(row.members),
    claimMethod: text(row.claimMethod),
    claimed: row.claimed === true,
    verificationStatus: text(row.verificationStatus),
    pendingClaim: readPendingClaim(row.pendingClaim),
    verifiedAt: text(row.verifiedAt),
    suspendedAt: text(row.suspendedAt),
    audit: readAudit(row.audit),
  };
}

export function readDirectJobList(body: unknown): ReadList<AdminDirectJob> {
  const jobs = asRecord(body)?.jobs;
  if (!Array.isArray(jobs)) return { rows: [], total: 0, recognized: false };
  const rows = jobs.map(readAdminDirectJob).filter((item): item is AdminDirectJob => item !== null);
  if (jobs.length > 0 && rows.length === 0) return { rows: [], total: 0, recognized: false };
  return { rows, total: readTotal(body, rows.length), recognized: true };
}

/** Review and take-down both answer `{ job, auditId }`. */
export function readReviewedJob(body: unknown): AdminDirectJob | null {
  return readAdminDirectJob(asRecord(body)?.job);
}

function readVerificationRow(value: unknown): VerificationRow | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = text(row.id);
  const companyId = text(row.companyId);
  if (!id || !companyId) return null;
  return {
    id,
    companyId,
    companyName: text(row.companyName),
    claimMethod: text(row.claimMethod),
    requestedBy: text(row.requestedBy),
    domains: stringList(row.domains),
    memberCount: count(row.memberCount),
    status: text(row.status),
    createdAt: text(row.createdAt),
    slaAt: text(row.slaAt),
  };
}

function readAdminDirectJob(value: unknown): AdminDirectJob | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = text(row.id);
  if (!id) return null;
  return {
    id,
    title: text(row.title) || "Untitled job",
    companyId: text(row.companyId),
    companyName: text(row.companyName),
    source: text(row.source),
    status: text(row.status),
    postedAt: text(row.postedAt),
    createdAt: text(row.createdAt),
    location: text(row.location),
  };
}

function readDomains(value: unknown): CompanyDomain[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    const domain = text(row?.domain);
    if (!domain) return [];
    return [{ domain, verified: row?.verified === true }];
  });
}

function readMembers(value: unknown): CompanyMember[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    const userId = text(row?.userId);
    if (!userId) return [];
    return [
      {
        userId,
        email: text(row?.email),
        role: text(row?.role),
        createdAt: text(row?.createdAt),
      },
    ];
  });
}

function readPendingClaim(value: unknown): PendingClaim | null {
  const row = asRecord(value);
  const id = text(row?.id);
  if (!id) return null;
  return {
    id,
    method: text(row?.method),
    requestedBy: text(row?.requestedBy),
    createdAt: text(row?.createdAt),
  };
}

function readAudit(value: unknown): VerificationAudit[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    return [
      {
        at: text(row.at),
        actor: text(row.actor),
        action: text(row.action),
        reason: text(row.reason),
      },
    ];
  });
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

function readTotal(body: unknown, fallback: number) {
  const total = asRecord(body)?.total;
  return typeof total === "number" && Number.isFinite(total) ? total : fallback;
}

function count(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
