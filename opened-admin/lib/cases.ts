/**
 * Provisional staff client for the reports and disputes queues.
 *
 * This branch has no /v1/admin/cases routes. Paths follow the docs/32 sketch,
 * plus a detail GET the sketch does not name. Calls go through the admin proxy
 * (ADMIN_API_TOKEN and X-Admin-Actor). CamelCase matches the other staff
 * contracts; snake_case aliases are read so a docs-shaped payload still parses.
 *
 * Decision values are not locked: reports use uphold/dismiss (docs/32 events);
 * disputes use settled/voided (docs/30). Enforcement actions are the ladder in
 * docs/32, sent only when selected.
 */

import { TRUST_PAGE_SIZE, requireReason, type ReadList } from "./trust";

export const ADMIN_CASES_PATH = "/v1/admin/cases";

export const REPORTS_QUEUE = "reports";
export const DISPUTES_QUEUE = "disputes";
export const CASE_STATUS_OPEN = "open";
export const CASE_STATUS_DECIDED = "decided";

/** Reports are due 48 hours after they open. */
export const REPORT_SLA_HOURS = 48;
/** Disputes are due 5 business days after they open. */
export const DISPUTE_SLA_BUSINESS_DAYS = 5;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const CASE_QUEUES = [
  { value: REPORTS_QUEUE, label: "Reports" },
  { value: DISPUTES_QUEUE, label: "Disputes" },
] as const;

export const CASE_STATUSES = [
  { value: CASE_STATUS_OPEN, label: "Open" },
  { value: CASE_STATUS_DECIDED, label: "Decided" },
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

export type CaseReasonCode = (typeof CASE_REASON_CODES)[number]["value"];
export type CaseQueue = (typeof CASE_QUEUES)[number]["value"];
export type CaseListStatus = (typeof CASE_STATUSES)[number]["value"];

export const REPORT_DECISIONS = [
  { value: "uphold", label: "Uphold" },
  { value: "dismiss", label: "Dismiss" },
] as const;

export const DISPUTE_DECISIONS = [
  { value: "settled", label: "Settle" },
  { value: "voided", label: "Void" },
] as const;

export type ReportDecision = (typeof REPORT_DECISIONS)[number]["value"];
export type DisputeDecision = (typeof DISPUTE_DECISIONS)[number]["value"];

/** Docs/32 enforcement ladder, provisional action codes. */
export const CASE_ACTIONS = [
  { value: "warning", label: "Warning" },
  { value: "quota_reduction", label: "Quota reduction" },
  { value: "feature_restriction", label: "Feature restriction" },
  { value: "payout_hold", label: "Payout hold" },
  { value: "suspension", label: "Suspension" },
  { value: "ban", label: "Ban" },
] as const;

export type CaseAction = (typeof CASE_ACTIONS)[number]["value"];

export type CaseDecisionBody = {
  decision: ReportDecision | DisputeDecision;
  reason: string;
  actions: CaseAction[];
};

export type ModerationCase = {
  id: string;
  queue: string;
  status: string;
  reasonCode: string;
  subjectType: string;
  subjectId: string;
  subjectLabel: string;
  reporterId: string;
  createdAt: string;
  slaAt: string;
  decision: string;
};

export type CaseEvidence = {
  id: string;
  label: string;
  url: string;
  note: string;
};

export type CaseSubject = {
  type: string;
  id: string;
  label: string;
};

export type CaseHistory = {
  at: string;
  actor: string;
  action: string;
  reason: string;
};

export type CaseDetail = ModerationCase & {
  details: string;
  evidence: CaseEvidence[];
  subjects: CaseSubject[];
  history: CaseHistory[];
};

export function caseListQueue(value: string | null | undefined): CaseQueue {
  return value === DISPUTES_QUEUE ? DISPUTES_QUEUE : REPORTS_QUEUE;
}

export function caseListStatus(value: string | null | undefined): CaseListStatus {
  return value === CASE_STATUS_DECIDED ? CASE_STATUS_DECIDED : CASE_STATUS_OPEN;
}

export function reasonCodeLabel(code: string) {
  if (!code) return "—";
  return CASE_REASON_CODES.find((item) => item.value === code)?.label ?? code;
}

export function caseDecisions(queue: string) {
  return queue === DISPUTES_QUEUE ? DISPUTE_DECISIONS : REPORT_DECISIONS;
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

export function casePath(id: string) {
  return `${ADMIN_CASES_PATH}/${encodeURIComponent(id)}`;
}

export function caseDecisionPath(id: string) {
  return `${casePath(id)}/decision`;
}

/** Page query. Defaults (reports, open, page 1) stay off the URL. */
export function casesListQuery(queue: string, status: string, page: number) {
  const params = new URLSearchParams();
  if (caseListQueue(queue) !== REPORTS_QUEUE) params.set("queue", DISPUTES_QUEUE);
  if (caseListStatus(status) !== CASE_STATUS_OPEN) params.set("status", CASE_STATUS_DECIDED);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function caseDecisionBody(
  queue: string,
  decision: string,
  reason: string,
  actions: readonly string[],
): CaseDecisionBody {
  const allowed = caseDecisions(queue);
  const match = allowed.find((item) => item.value === decision);
  if (!match) throw new Error("Choose a decision.");
  const unique = [...new Set(actions.map((action) => action.trim()).filter(Boolean))];
  const known = new Set<string>(CASE_ACTIONS.map((item) => item.value));
  if (unique.some((action) => !known.has(action))) throw new Error("Unknown action.");
  return {
    decision: match.value,
    reason: requireReason(reason),
    actions: unique as CaseAction[],
  };
}

/** Prefer an API slaAt. Otherwise reports are +48h and disputes are +5 business days. */
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
  const record = asRecord(body);
  const raw = Array.isArray(record?.cases)
    ? record.cases
    : Array.isArray(record?.data)
      ? record.data
      : null;
  if (!raw) return { rows: [], total: 0, recognized: false };
  const rows = raw.map(readCaseRow).filter((item): item is ModerationCase => item !== null);
  if (raw.length > 0 && rows.length === 0) return { rows: [], total: 0, recognized: false };
  return { rows, total: readTotal(body, rows.length), recognized: true };
}

export function readCaseDetail(body: unknown): CaseDetail | null {
  const root = asRecord(body);
  const row = asRecord(root?.case) ?? root;
  const base = readCaseRow(row);
  if (!base || !row) return null;
  return {
    ...base,
    details: preferText(row.details, row.statement),
    evidence: readEvidence(row.evidence ?? row.evidenceKeys ?? row.evidence_keys),
    subjects: readSubjects(
      row.subjects ?? row.linkedSubjects ?? row.linkedAccounts ?? row.linked_accounts,
    ),
    history: readHistory(row.history ?? row.audit),
  };
}

function readCaseRow(value: unknown): ModerationCase | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = text(row.id);
  if (!id) return null;
  const subject = asRecord(row.subject);
  return {
    id,
    queue: text(row.queue),
    status: text(row.status),
    reasonCode: preferText(row.reasonCode, row.reason_code),
    subjectType: preferText(row.subjectType, row.subject_type, subject?.type),
    subjectId: preferText(row.subjectId, row.subject_id, subject?.id),
    subjectLabel: preferText(row.subjectLabel, row.subjectName, subject?.label, subject?.name),
    reporterId: preferText(row.reporterId, row.reporterUserId, row.reporter_user_id),
    createdAt: preferText(row.createdAt, row.created_at),
    slaAt: preferText(row.slaAt, row.sla_at, row.dueAt),
    decision: text(row.decision),
  };
}

function readEvidence(value: unknown): CaseEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (typeof item === "string") {
      const label = item.trim();
      return label ? [{ id: label, label, url: "", note: "" }] : [];
    }
    const row = asRecord(item);
    const label = preferText(row?.label, row?.key, row?.name);
    const url = preferText(row?.url, row?.href);
    const note = preferText(row?.note, row?.details);
    const id = preferText(row?.id, label, url) || String(index);
    if (!label && !url && !note) return [];
    return [{ id, label: label || url, url, note }];
  });
}

function readSubjects(value: unknown): CaseSubject[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    const id = preferText(row?.id, row?.subjectId);
    const type = preferText(row?.type, row?.subjectType);
    if (!id && !type) return [];
    return [{ type, id, label: preferText(row?.label, row?.name) }];
  });
}

function readHistory(value: unknown): CaseHistory[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    return [
      {
        at: preferText(row.at, row.createdAt),
        actor: text(row.actor),
        action: text(row.action),
        reason: preferText(row.note, row.reason),
      },
    ];
  });
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

function preferText(...values: unknown[]) {
  for (const value of values) {
    const parsed = text(value);
    if (parsed) return parsed;
  }
  return "";
}
