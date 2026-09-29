/**
 * Layer E — Offer & hire (scaffold) shapes.
 *
 * Einstein contract (persist + return these fields; UI scaffolds against them):
 *
 * GET/PUT /v1/company/jobs/:id  (and list, when cheap)
 *   CompanyJob.offerTemplates?: OfferTemplate[]
 *
 * GET /v1/company/applicants  (and single)
 *   Applicant.offer?: OfferRecord
 *
 * PATCH /v1/company/applicants/:id
 *   Existing: columnId / notes / rating / tags / interviewerIds
 *   Also accept (scaffold):
 *     body.offer?: OfferPatch
 *   Moving to columnId "hired" should keep offer.status "accepted" (or set it).
 *   Moving to columnId "offer" with offer.status omitted → treat as draft.
 *   Do NOT invent DocuSign / SSO / external e-sign connectors.
 *
 * POST /v1/company/applicants/:id/offer/approvals
 *   body: { note?: string; approverIds?: string[] }
 *   response: OfferApproval  // light internal approval only
 *
 * PATCH /v1/company/applicants/:id/offer/approvals/:approvalId
 *   body: { status: "approved" | "rejected"; note?: string }
 *
 * POST /v1/company/applicants/:id/offer/esign
 *   body: { documentTitle?: string }
 *   response: OfferEsign  // first-party only; mint a signed URL on OpenSeat
 *
 * POST /v1/company/applicants/:id/hire-packet
 *   body: HirePacketInput
 *   response: HirePacket  // light onboarding handoff stub, not full HRIS
 *
 * Out of scope here: DocuSign, SSO, RBAC (F), analytics (G), Scoutwell, admin.
 */

import { formatISODate } from "@/lib/dates";

export type OfferStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "withdrawn";

export type CompPackage = {
  /** Annual base in integer cents. */
  baseSalaryCents?: number;
  currency?: string;
  equityNote?: string;
  /** Annual / target bonus in cents. */
  bonusCents?: number;
  signingBonusCents?: number;
  /** YYYY-MM-DD proposed start. */
  startDate?: string;
  notes?: string;
};

export type OfferTemplate = {
  id: string;
  name: string;
  /** Plain-text / markdown body with {{name}} {{role}} placeholders. */
  body: string;
  defaultComp?: CompPackage;
  requiresApproval?: boolean;
  requiresEsign?: boolean;
};

export type OfferApprovalStatus = "pending" | "approved" | "rejected";

export type OfferApproval = {
  id: string;
  status: OfferApprovalStatus;
  requestedAt: string;
  decidedAt?: string;
  approverIds?: string[];
  decidedBy?: string;
  note?: string;
};

/** First-party e-sign only — no DocuSign / HelloSign connectors. */
export type OfferEsignStatus = "none" | "pending" | "signed" | "declined";

export type OfferEsign = {
  status: OfferEsignStatus;
  documentTitle?: string;
  /** OpenSeat-hosted sign URL when Einstein mints one. */
  signUrl?: string;
  sentAt?: string;
  signedAt?: string;
};

export type HirePacketItemStatus = "todo" | "done" | "skipped";

export type HirePacketItem = {
  id: string;
  label: string;
  status: HirePacketItemStatus;
};

export type HirePacketStatus = "none" | "draft" | "ready" | "sent";

export type HirePacket = {
  status: HirePacketStatus;
  checklist: HirePacketItem[];
  startDate?: string;
  ownerNote?: string;
  /** Where to hand off (email / Slack / HRIS stub). */
  handoffTarget?: string;
  generatedAt?: string;
};

export type OfferRecord = {
  status: OfferStatus;
  templateId?: string;
  /** ISO-8601 when the offer was sent to the candidate. */
  sentAt?: string;
  /** ISO-8601 when accepted / declined. */
  respondedAt?: string;
  /** YYYY-MM-DD expiry. */
  expiresAt?: string;
  notes?: string;
  comp?: CompPackage;
  approval?: OfferApproval;
  esign?: OfferEsign;
  hirePacket?: HirePacket;
};

/** PATCH body fragment — sparse update of offer fields. */
export type OfferPatch = {
  status?: OfferStatus;
  templateId?: string | null;
  sentAt?: string | null;
  respondedAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
  comp?: CompPackage | null;
};

export type HirePacketInput = {
  startDate?: string;
  ownerNote?: string;
  handoffTarget?: string;
  /** When true, reset checklist to the default hire stubs. */
  resetChecklist?: boolean;
};

export const OFFER_STATUSES: OfferStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "accepted",
  "declined",
  "expired",
  "withdrawn",
];

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  withdrawn: "Withdrawn",
};

export const MAX_OFFER_TEMPLATES = 8;
export const MAX_OFFER_NOTES = 2000;
export const MAX_EQUITY_NOTE = 280;
export const MAX_COMP_NOTES = 500;
export const MAX_HIRE_CHECKLIST = 12;
export const DEFAULT_OFFER_CURRENCY = "USD";

export const DEFAULT_HIRE_CHECKLIST_LABELS = [
  "Send welcome email",
  "Collect payroll / tax forms",
  "Provision laptop & accounts",
  "Schedule day-one orientation",
  "Add to team channels",
];

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newOfferTemplate(partial?: Partial<OfferTemplate>): OfferTemplate {
  return {
    id: newId("otmpl"),
    name: "Standard offer",
    body: "Dear {{name}},\n\nWe are pleased to offer you the {{role}} role.\n\nPlease reply with your decision.",
    defaultComp: {},
    requiresApproval: false,
    requiresEsign: false,
    ...partial,
  };
}

export function emptyCompPackage(currency = DEFAULT_OFFER_CURRENCY): CompPackage {
  return { currency };
}

export function emptyOffer(partial?: Partial<OfferRecord>): OfferRecord {
  return {
    status: "draft",
    comp: emptyCompPackage(),
    esign: { status: "none" },
    hirePacket: { status: "none", checklist: [] },
    ...partial,
  };
}

export function defaultHireChecklist(): HirePacketItem[] {
  return DEFAULT_HIRE_CHECKLIST_LABELS.map((label) => ({
    id: newId("hire"),
    label,
    status: "todo" as const,
  }));
}

export function newHirePacket(partial?: Partial<HirePacket>): HirePacket {
  return {
    status: "draft",
    checklist: defaultHireChecklist(),
    generatedAt: new Date().toISOString(),
    ...partial,
  };
}

function clampInt(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

function hydrateOptionalString(raw: unknown, max: number): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed.slice(0, max) : undefined;
}

function hydrateIsoDate(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed).toISOString();
}

function hydrateYmd(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

export function hydrateCompPackage(raw: CompPackage | undefined | null): CompPackage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const comp: CompPackage = {
    baseSalaryCents: clampInt(raw.baseSalaryCents),
    currency: hydrateOptionalString(raw.currency, 8)?.toUpperCase() || DEFAULT_OFFER_CURRENCY,
    equityNote: hydrateOptionalString(raw.equityNote, MAX_EQUITY_NOTE),
    bonusCents: clampInt(raw.bonusCents),
    signingBonusCents: clampInt(raw.signingBonusCents),
    startDate: hydrateYmd(raw.startDate),
    notes: hydrateOptionalString(raw.notes, MAX_COMP_NOTES),
  };
  const hasValue =
    comp.baseSalaryCents !== undefined ||
    Boolean(comp.equityNote) ||
    comp.bonusCents !== undefined ||
    comp.signingBonusCents !== undefined ||
    Boolean(comp.startDate) ||
    Boolean(comp.notes);
  return hasValue || comp.currency ? comp : undefined;
}

export function hydrateOfferApproval(
  raw: OfferApproval | undefined | null,
): OfferApproval | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const status: OfferApprovalStatus =
    raw.status === "approved" || raw.status === "rejected" ? raw.status : "pending";
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newId("oapr"),
    status,
    requestedAt: hydrateIsoDate(raw.requestedAt) || new Date().toISOString(),
    decidedAt: hydrateIsoDate(raw.decidedAt),
    approverIds: Array.isArray(raw.approverIds)
      ? raw.approverIds.map(String).filter(Boolean).slice(0, 12)
      : undefined,
    decidedBy: hydrateOptionalString(raw.decidedBy, 120),
    note: hydrateOptionalString(raw.note, MAX_OFFER_NOTES),
  };
}

export function hydrateOfferEsign(raw: OfferEsign | undefined | null): OfferEsign | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const status: OfferEsignStatus =
    raw.status === "pending" || raw.status === "signed" || raw.status === "declined"
      ? raw.status
      : "none";
  return {
    status,
    documentTitle: hydrateOptionalString(raw.documentTitle, 200),
    signUrl: hydrateOptionalString(raw.signUrl, 500),
    sentAt: hydrateIsoDate(raw.sentAt),
    signedAt: hydrateIsoDate(raw.signedAt),
  };
}

export function hydrateHirePacket(raw: HirePacket | undefined | null): HirePacket | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const status: HirePacketStatus =
    raw.status === "draft" || raw.status === "ready" || raw.status === "sent" ? raw.status : "none";
  const checklist = Array.isArray(raw.checklist)
    ? raw.checklist
        .filter((item) => item && typeof item.label === "string")
        .map((item) => ({
          id: item.id || newId("hire"),
          label: item.label.trim().slice(0, 120),
          status:
            item.status === "done" || item.status === "skipped"
              ? item.status
              : ("todo" as HirePacketItemStatus),
        }))
        .filter((item) => item.label.length > 0)
        .slice(0, MAX_HIRE_CHECKLIST)
    : [];
  return {
    status,
    checklist,
    startDate: hydrateYmd(raw.startDate),
    ownerNote: hydrateOptionalString(raw.ownerNote, MAX_COMP_NOTES),
    handoffTarget: hydrateOptionalString(raw.handoffTarget, 200),
    generatedAt: hydrateIsoDate(raw.generatedAt),
  };
}

export function hydrateOfferTemplates(raw: OfferTemplate[] | undefined | null): OfferTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item.name === "string")
    .map((item) => ({
      id: item.id || newId("otmpl"),
      name: item.name.trim().slice(0, 120),
      body: typeof item.body === "string" ? item.body.slice(0, 8000) : "",
      defaultComp: hydrateCompPackage(item.defaultComp),
      requiresApproval: Boolean(item.requiresApproval),
      requiresEsign: Boolean(item.requiresEsign),
    }))
    .filter((item) => item.name.length > 0)
    .slice(0, MAX_OFFER_TEMPLATES);
}

export function hydrateOfferRecord(raw: OfferRecord | undefined | null): OfferRecord | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const status = OFFER_STATUSES.includes(raw.status as OfferStatus)
    ? (raw.status as OfferStatus)
    : "draft";
  return {
    status,
    templateId: hydrateOptionalString(raw.templateId, 80),
    sentAt: hydrateIsoDate(raw.sentAt),
    respondedAt: hydrateIsoDate(raw.respondedAt),
    expiresAt: hydrateYmd(raw.expiresAt),
    notes: hydrateOptionalString(raw.notes, MAX_OFFER_NOTES),
    comp: hydrateCompPackage(raw.comp),
    approval: hydrateOfferApproval(raw.approval),
    esign: hydrateOfferEsign(raw.esign),
    hirePacket: hydrateHirePacket(raw.hirePacket),
  };
}

export type OfferTransitionInput = {
  from: OfferStatus;
  to: OfferStatus;
  requiresApproval?: boolean;
};

export type OfferTransitionResult = { ok: true } | { ok: false; reason: string };

/** Client-side guardrails for offer status moves (Einstein may be stricter). */
export function canTransitionOffer(input: OfferTransitionInput): OfferTransitionResult {
  const { from, to, requiresApproval } = input;
  if (from === to) return { ok: true };

  const allowed: Record<OfferStatus, OfferStatus[]> = {
    draft: ["pending_approval", "approved", "sent", "withdrawn"],
    pending_approval: ["approved", "draft", "withdrawn"],
    approved: ["sent", "withdrawn", "draft"],
    sent: ["accepted", "declined", "expired", "withdrawn"],
    accepted: ["accepted"],
    declined: ["draft", "withdrawn"],
    expired: ["draft", "sent", "withdrawn"],
    withdrawn: ["draft"],
  };

  if (to === "sent" && requiresApproval && from !== "approved" && from !== "sent") {
    return { ok: false, reason: "Get approval before sending this offer." };
  }
  if (!(allowed[from] ?? []).includes(to)) {
    return {
      ok: false,
      reason: `Cannot move offer from ${OFFER_STATUS_LABEL[from]} to ${OFFER_STATUS_LABEL[to]}.`,
    };
  }
  return { ok: true };
}

/** Apply a status change with timestamps; returns a new OfferRecord. */
export function applyOfferStatus(
  current: OfferRecord | undefined,
  nextStatus: OfferStatus,
  extras?: { notes?: string; expiresAt?: string; now?: Date },
): OfferRecord {
  const base = current
    ? { ...current, comp: current.comp ? { ...current.comp } : undefined }
    : emptyOffer();
  const now = extras?.now ?? new Date();
  const iso = now.toISOString();
  const next: OfferRecord = {
    ...base,
    status: nextStatus,
    notes: extras?.notes !== undefined ? extras.notes.slice(0, MAX_OFFER_NOTES) : base.notes,
    expiresAt: extras?.expiresAt ?? base.expiresAt,
  };
  if (nextStatus === "sent") {
    next.sentAt = iso;
    next.respondedAt = undefined;
  }
  if (nextStatus === "accepted" || nextStatus === "declined") {
    next.respondedAt = iso;
    if (!next.sentAt) next.sentAt = iso;
  }
  if (nextStatus === "pending_approval") {
    next.approval = {
      id: base.approval?.id || newId("oapr"),
      status: "pending",
      requestedAt: iso,
      approverIds: base.approval?.approverIds,
      note: base.approval?.note,
    };
  }
  if (nextStatus === "approved" && next.approval) {
    next.approval = {
      ...next.approval,
      status: "approved",
      decidedAt: iso,
    };
  }
  return next;
}

/** Dollars → cents for form fields (empty → undefined). */
export function dollarsToCents(raw: string): number | undefined {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return undefined;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

export function centsToDollarsInput(cents: number | undefined): string {
  if (cents === undefined || cents === null) return "";
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

export function renderOfferBody(
  template: OfferTemplate,
  vars: { name: string; role: string },
): string {
  return template.body
    .replace(/\{\{\s*name\s*\}\}/gi, vars.name)
    .replace(/\{\{\s*role\s*\}\}/gi, vars.role);
}

/** Scaffold first-party sign URL when Einstein has not minted one. */
export function scaffoldEsignUrl(applicantId: string, origin?: string): string {
  const base =
    origin || (typeof window !== "undefined" ? window.location.origin : "https://openseat.app");
  return `${base}/offer/sign/${encodeURIComponent(applicantId)}`;
}

export function offerReadyToHire(offer: OfferRecord | undefined): boolean {
  return offer?.status === "accepted";
}

export function todayYmd(now = new Date()): string {
  return formatISODate(now);
}

export function buildOfferPatch(offer: OfferRecord): OfferPatch {
  return {
    status: offer.status,
    templateId: offer.templateId ?? null,
    sentAt: offer.sentAt ?? null,
    respondedAt: offer.respondedAt ?? null,
    expiresAt: offer.expiresAt ?? null,
    notes: offer.notes ?? null,
    comp: offer.comp ?? null,
  };
}
