/**
 * Layer A — Company jobs polish (templates, close/archive, org catalog, careers).
 *
 * Einstein contract (persist + return these fields; UI scaffolds against them):
 *
 * GET/PUT /v1/company/job-templates
 *   body/response: { templates: JobTemplate[] }
 *   Soft-fails local until landed; frontend keeps a local cache for reuse.
 *
 * GET/PUT /v1/company/departments
 *   body/response: { departments: string[]; rename?: { from: string; to: string } }
 *   Until landed, frontend falls back to GET/PUT /v1/company/job-teams (same shape
 *   with `teams`). CompanyJob.team remains the persisted department label.
 *
 * GET/PUT /v1/company/office-locations
 *   body/response: { locations: string[]; rename?: { from: string; to: string } }
 *   Catalog of office / hiring cities. Job.location stays a free-text string;
 *   the catalog only seeds the picker.
 *
 * GET/PUT /v1/company/jobs  (and GET single)
 *   CompanyJob.department?: string   // optional alias; prefer same value as team
 *   CompanyJob.closedAt?: string     // ISO when status became "closed"
 *   CompanyJob.closeReason?: string  // short note shown in console + auto-reply
 *   CompanyJob.notifyOnClose?: boolean // whether candidates were told (echo)
 *
 * PATCH /v1/company/jobs/:id
 *   Existing: { status }
 *   Also accept (scaffold):
 *     body.closeReason?: string
 *     body.notifyOnClose?: boolean   // default true when status → closed
 *   status "open" on a closed job = reopen (clear closedAt / closeReason).
 *
 * Public careers (light):
 *   GET /v1/search/companies/:id already returns open jobs.
 *   Optional later: ?department=&location= filters. Do NOT invent a branded
 *   multi-page careers portal — company public page open-roles is enough.
 *
 * Out of scope: SSO, Integrations, Scoutwell, admin, heavy ATS sync.
 * Related: assisted policy lives on CompanyJob.policy (done). Intake: lib/intake.ts.
 */

import type { Seniority, Workplace } from "@/lib/jobs";
import { hydrateScreeningQuestions, type ScreeningQuestion } from "@/lib/intake";

export const MAX_JOB_TEMPLATES = 12;
export const MAX_DEPARTMENTS = 40;
export const MAX_OFFICE_LOCATIONS = 40;
export const MAX_TEMPLATE_NAME = 80;
export const MAX_CLOSE_REASON = 200;

/** Snapshot of a job draft a hiring team can reuse. */
export type JobTemplate = {
  id: string;
  name: string;
  title: string;
  team: string;
  /** Optional; mirrors team when Einstein has no separate department field. */
  department?: string;
  seniority: Seniority;
  location: string;
  workplace: Workplace;
  payMin: number;
  payMax: number;
  currency: string;
  visa: boolean;
  summary: string;
  skills: string[];
  responsibilities: string[];
  requirements: string[];
  description: string;
  screeningQuestions: ScreeningQuestion[];
  updatedAt: string;
};

export type JobTemplateDraft = Omit<JobTemplate, "id" | "name" | "updatedAt">;

export type CloseJobPayload = {
  status: "closed";
  closeReason?: string;
  notifyOnClose?: boolean;
};

export function newJobTemplateId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `jt-${crypto.randomUUID()}`
    : `jt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newJobTemplate(
  name: string,
  draft: JobTemplateDraft,
  partial?: Partial<JobTemplate>,
): JobTemplate {
  return {
    id: newJobTemplateId(),
    name: name.trim().slice(0, MAX_TEMPLATE_NAME) || "Untitled template",
    ...draft,
    screeningQuestions: hydrateScreeningQuestions(draft.screeningQuestions),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

function hydrateStringList(raw: string[] | undefined | null, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((item) => String(item ?? "").trim()).filter(Boolean))].slice(0, max);
}

export function hydrateDepartments(raw: string[] | undefined | null): string[] {
  return hydrateStringList(raw, MAX_DEPARTMENTS);
}

export function hydrateOfficeLocations(raw: string[] | undefined | null): string[] {
  return hydrateStringList(raw, MAX_OFFICE_LOCATIONS);
}

export function hydrateJobTemplate(raw: JobTemplate | undefined | null): JobTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name ?? "").trim();
  if (!name) return null;
  return {
    id: String(raw.id || newJobTemplateId()),
    name: name.slice(0, MAX_TEMPLATE_NAME),
    title: String(raw.title ?? ""),
    team: String(raw.team ?? raw.department ?? ""),
    department: String(raw.department ?? raw.team ?? "") || undefined,
    seniority: (raw.seniority as Seniority) || "Middle",
    location: String(raw.location ?? ""),
    workplace: (raw.workplace as Workplace) || "hybrid",
    payMin: Number(raw.payMin) || 0,
    payMax: Number(raw.payMax) || 0,
    currency: String(raw.currency ?? "USD"),
    visa: Boolean(raw.visa),
    summary: String(raw.summary ?? ""),
    skills: hydrateStringList(raw.skills, 40),
    responsibilities: hydrateStringList(raw.responsibilities, 20),
    requirements: hydrateStringList(raw.requirements, 20),
    description: String(raw.description ?? ""),
    screeningQuestions: hydrateScreeningQuestions(raw.screeningQuestions),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

export function hydrateJobTemplates(raw: JobTemplate[] | undefined | null): JobTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => hydrateJobTemplate(item))
    .filter((item): item is JobTemplate => item != null)
    .slice(0, MAX_JOB_TEMPLATES);
}

export function templateToDraft(template: JobTemplate): JobTemplateDraft {
  return {
    title: template.title,
    team: template.team || template.department || "",
    department: template.department || template.team || undefined,
    seniority: template.seniority,
    location: template.location,
    workplace: template.workplace,
    payMin: template.payMin,
    payMax: template.payMax,
    currency: template.currency,
    visa: template.visa,
    summary: template.summary,
    skills: template.skills,
    responsibilities: template.responsibilities,
    requirements: template.requirements,
    description: template.description,
    screeningQuestions: template.screeningQuestions,
  };
}

/** Group public open roles by team/department for the careers listing. */
export function groupJobsByDepartment<T extends { team?: string }>(
  jobs: T[],
): { department: string; jobs: T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const job of jobs) {
    const key = (job.team ?? "").trim() || "General";
    const list = buckets.get(key);
    if (list) list.push(job);
    else buckets.set(key, [job]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([department, group]) => ({ department, jobs: group }));
}

export function uniqueJobLocations<T extends { location?: string }>(jobs: T[]): string[] {
  return [...new Set(jobs.map((job) => (job.location ?? "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}
