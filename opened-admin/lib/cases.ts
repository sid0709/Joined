/**
 * Layer H trust cases. Provisional lock from docs/32 and Einstein.
 * CamelCase JSON. Staff calls go through the admin proxy, which adds
 * ADMIN_API_TOKEN and X-Admin-Actor. This branch has no cases routes yet.
 *
 * Public (types only; no admin UI):
 *   POST /v1/reports
 *     { subjectType, subjectId, reasonCode, details, evidenceKeys[] }
 *   GET  /v1/me/reports
 *   POST /v1/reports/{id}/appeal
 *     { statement, evidenceKeys[] }
 *   reasonCode:
 *     no_show | identity_mismatch | proxy_interviewer | fake_credentials |
 *     abusive_behavior | scam_job | fake_company | fabricated_application |
 *     payment_request | other_with_evidence
 *
 * Staff:
 *   GET  /v1/admin/cases?queue=reports|disputes|fraud_flags&status=&page=&pageSize=
 *     status values named in the lock: open | pending | resolved.
 *     Other status strings are forwarded as-is (the lock allows more).
 *   POST /v1/admin/cases/{id}/decision
 *     { decision: "uphold" | "dismiss", reason, actions?[] }
 *     actions is omitted when empty. Action codes are not locked, so the UI
 *     does not offer any.
 *
 * Assumed list body until Einstein publishes the wire (camelCase only):
 *   { cases: AdminCase[], total?: number }
 *   AdminCase: {
 *     id, queue?, status?, reasonCode?, subjectType?, subjectId?,
 *     details?, evidenceKeys?: string[], createdAt?, slaAt?, decision?
 *   }
 * There is no locked get-by-id. The detail page repeats the list row and
 * posts the decision. SLA when slaAt is absent: disputes +5 business days,
 * reports and fraud_flags +48h (docs/32 default).
 */

import { TRUST_PAGE_SIZE, requireReason, type ReadList } from "./trust";

export const REPORTS_PATH = "/v1/reports";
export const MY_REPORTS_PATH = "/v1/me/reports";
export const ADMIN_CASES_PATH = "/v1/admin/cases";

export const REPORTS_QUEUE = "reports";
export const DISPUTES_QUEUE = "disputes";
export const FRAUD_FLAGS_QUEUE = "fraud_flags";

export const CASE_STATUS_OPEN = "open";
export const CASE_STATUS_PENDING = "pending";
export const CASE_STATUS_RESOLVED = "resolved";

/** Reports and fraud flags are due 48 hours after they open (docs/32 default). */
export const REPORT_SLA_HOURS = 48;
/** Disputes are due 5 business days after they open. */
export const DISPUTE_SLA_BUSINESS_DAYS = 5;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const CASE_QUEUES = [
  { value: REPORTS_QUEUE, label: "Reports" },
  { value: DISPUTES_QUEUE, label: "Disputes" },
  { value: FRAUD_FLAGS_QUEUE, label: "Fraud flags" },
] as const;

export const CASE_STATUSES = [
  { value: CASE_STATUS_OPEN, label: "Open" },
  { value: CASE_STATUS_PENDING, label: "Pending" },
  { value: CASE_STATUS_RESOLVED, label: "Resolved" },
] as const;

export const CASE_REASON_CODES = [
  { value: "no_show", label: "No show" },
  { value: "identity_mismatch", label: "Identity mismatch" },
  { value: "proxy_interviewer", label: "Proxy interviewer" },
  { value: "fake_credentials", label: "Fake credentials" },
  { value: "abusive_behavior", label: "Abusive behavior" },
  { value: "scam_job", label: "Scam job" },
  { value: "fake_company", label: "Fake company" },
  { value: "fabricated_application", label: "Fabricated application" },
  { value: "payment_request", label: "Payment request" },
  { value: "other_with_evidence", label: "Other, with evidence" },
] as const;

/** Company hiring reviews. Still part of the full reason enum. */
export const COMPANY_ATS_REASON_CODES = ["scam_job", "fake_company", "identity_mismatch"] as const;

export const CASE_DECISIONS = [
  { value: "uphold", label: "Uphold" },
  { value: "dismiss", label: "Dismiss" },
] as const;

export type CaseReasonCode = (typeof CASE_REASON_CODES)[number]["value"];
export type CompanyAtsReasonCode = (typeof COMPANY_ATS_REASON_CODES)[number]["value"];
export type CaseQueue = (typeof CASE_QUEUES)[number]["value"];
export type CaseDecision = (typeof CASE_DECISIONS)[number]["value"];

export type FileReportBody = {
  subjectType: string;
  subjectId: string;
  reasonCode: CaseReasonCode;
  details: string;
  evidenceKeys: string[];
};

export type AppealReportBody = {
  statement: string;
  evidenceKeys: string[];
};

export type CaseDecisionBody = {
  decision: CaseDecision;
  reason: string;
  actions?: string[];
};

/** Assumed row inside `{ cases }`. Fields other than id may be empty. */
export type ModerationCase = {
  id: string;
  queue: string;
  status: string;
  reasonCode: string;
  subjectType: string;
  subjectId: string;
  details: string;
  evidenceKeys: string[];
  createdAt: string;
  slaAt: string;
  decision: string;
};

export function isReasonCode(value: string): value is CaseReasonCode {
  return CASE_REASON_CODES.some((item) => item.value === value);
}

export function isCompanyAtsReason(value: string): value is CompanyAtsReasonCode {
  return COMPANY_ATS_REASON_CODES.some((item) => item === value);
}

export function caseListQueue(value: string | null | undefined): CaseQueue {
  if (value === DISPUTES_QUEUE || value === FRAUD_FLAGS_QUEUE) return value;
  return REPORTS_QUEUE;
}

/** Named statuses stay. Any other non-empty status is forwarded. */
export function caseListStatus(value: string | null | undefined) {
  const status = value?.trim() ?? "";
  return status || CASE_STATUS_OPEN;
}

export function reasonCodeLabel(code: string) {
  if (!code) return "—";
  return CASE_REASON_CODES.find((item) => item.value === code)?.label ?? code;
}

export function caseQueueLabel(queue: string) {
  return CASE_QUEUES.find((item) => item.value === queue)?.label.toLowerCase() ?? "reports";
}

export function reportAppealPath(id: string) {
  return `${REPORTS_PATH}/${encodeURIComponent(id)}/appeal`;
}

export function fileReportBody(input: {
  subjectType: string;
  subjectId: string;
  reasonCode: string;
  details: string;
  evidenceKeys: readonly string[];
}): FileReportBody {
  if (!isReasonCode(input.reasonCode)) throw new Error("Unknown reason code.");
  const subjectType = input.subjectType.trim();
  const subjectId = input.subjectId.trim();
  if (!subjectType || !subjectId) throw new Error("Subject is required.");
  return {
    subjectType,
    subjectId,
    reasonCode: input.reasonCode,
    details: input.details.trim(),
    evidenceKeys: cleanKeys(input.evidenceKeys),
  };
}

export function appealReportBody(
  statement: string,
  evidenceKeys: readonly string[],
): AppealReportBody {
  return { statement: statement.trim(), evidenceKeys: cleanKeys(evidenceKeys) };
}

export function casesPath(queue: string, status: string, page: number, pageSize = TRUST_PAGE_SIZE) {
  const params = new URLSearchParams({
    queue: caseListQueue(queue),
    status: caseListStatus(status),
    page: String(page),
    pageSize: String(pageSize),
  });
  return `${ADMIN_CASES_PATH}?${params}`;
}

export function caseDecisionPath(id: string) {
  return `${ADMIN_CASES_PATH}/${encodeURIComponent(id)}/decision`;
}

/** Page query. Defaults (reports, open, page 1) stay off the URL. */
export function casesListQuery(queue: string, status: string, page: number) {
  const params = new URLSearchParams();
  const selected = caseListQueue(queue);
  const selectedStatus = caseListStatus(status);
  if (selected !== REPORTS_QUEUE) params.set("queue", selected);
  if (selectedStatus !== CASE_STATUS_OPEN) params.set("status", selectedStatus);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Decision body. `actions` is left off when none are passed. */
export function caseDecisionBody(
  decision: string,
  reason: string,
  actions?: readonly string[],
): CaseDecisionBody {
  const match = CASE_DECISIONS.find((item) => item.value === decision);
  if (!match) throw new Error("Choose a decision.");
  const unique = cleanKeys(actions ?? []);
  const body: CaseDecisionBody = { decision: match.value, reason: requireReason(reason) };
  if (unique.length > 0) body.actions = unique;
  return body;
}

/** Query string that carries an assumed list row onto the detail page. */
export function caseRecordQuery(row: ModerationCase) {
  const params = new URLSearchParams();
  setParam(params, "queue", row.queue);
  setParam(params, "status", row.status);
  setParam(params, "reasonCode", row.reasonCode);
  setParam(params, "subjectType", row.subjectType);
  setParam(params, "subjectId", row.subjectId);
  setParam(params, "details", row.details);
  setParam(params, "createdAt", row.createdAt);
  setParam(params, "slaAt", row.slaAt);
  setParam(params, "decision", row.decision);
  for (const key of row.evidenceKeys) params.append("evidenceKeys", key);
  return params.toString();
}

export function caseFromSearch(
  id: string,
  params: { get(name: string): string | null; getAll(name: string): string[] },
): ModerationCase {
  return {
    id,
    queue: params.get("queue")?.trim() ?? "",
    status: params.get("status")?.trim() ?? "",
    reasonCode: params.get("reasonCode")?.trim() ?? "",
    subjectType: params.get("subjectType")?.trim() ?? "",
    subjectId: params.get("subjectId")?.trim() ?? "",
    details: params.get("details")?.trim() ?? "",
    evidenceKeys: cleanKeys(params.getAll("evidenceKeys")),
    createdAt: params.get("createdAt")?.trim() ?? "",
    slaAt: params.get("slaAt")?.trim() ?? "",
    decision: params.get("decision")?.trim() ?? "",
  };
}

/** Prefer an assumed slaAt. Otherwise apply the docs/32 SLA from createdAt. */
export function caseDue(queue: string, createdAt: string, slaAt: string) {
  const provided = parseDate(slaAt);
  if (provided) return provided;
  const opened = parseDate(createdAt);
  if (!opened) return null;
  if (queue === DISPUTES_QUEUE) return addBusinessDays(opened, DISPUTE_SLA_BUSINESS_DAYS);
  return new Date(opened.getTime() + REPORT_SLA_HOURS * HOUR_MS);
}

export function slaLabel(due: Date | null, now = new Date()) {
  if (!due) return "—";
  const delta = due.getTime() - now.getTime();
  const span = durationLabel(Math.abs(delta));
  return delta >= 0 ? `due ${span}` : `overdue ${span}`;
}

export function slaOverdue(due: Date | null, now = new Date()) {
  return due !== null && due.getTime() < now.getTime();
}

export function readCaseList(body: unknown): ReadList<ModerationCase> {
  const cases = asRecord(body)?.cases;
  if (!Array.isArray(cases)) return { rows: [], total: 0, recognized: false };
  const rows = cases.map(readCaseRow).filter((item): item is ModerationCase => item !== null);
  if (cases.length > 0 && rows.length === 0) return { rows: [], total: 0, recognized: false };
  return { rows, total: readTotal(body, rows.length), recognized: true };
}

function readCaseRow(value: unknown): ModerationCase | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = text(row.id);
  if (!id) return null;
  return {
    id,
    queue: text(row.queue),
    status: text(row.status),
    reasonCode: text(row.reasonCode),
    subjectType: text(row.subjectType),
    subjectId: text(row.subjectId),
    details: text(row.details),
    evidenceKeys: cleanKeys(Array.isArray(row.evidenceKeys) ? row.evidenceKeys : []),
    createdAt: text(row.createdAt),
    slaAt: text(row.slaAt),
    decision: text(row.decision),
  };
}

/** Advance UTC calendar days, counting only Monday–Friday. */
export function addBusinessDays(start: Date, days: number) {
  const cursor = new Date(start.getTime());
  let left = days;
  while (left > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return cursor;
}

function cleanKeys(values: readonly unknown[]) {
  const unique: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const key = value.trim();
    if (key && !unique.includes(key)) unique.push(key);
  }
  return unique;
}

function setParam(params: URLSearchParams, name: string, value: string) {
  if (value) params.set(name, value);
}

function durationLabel(elapsed: number) {
  if (elapsed < HOUR_MS) return `${Math.max(0, Math.floor(elapsed / 60_000))}m`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h`;
  return `${Math.floor(elapsed / DAY_MS)}d`;
}

function parseDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readTotal(body: unknown, fallback: number) {
  const total = asRecord(body)?.total;
  return typeof total === "number" && Number.isFinite(total) ? total : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
