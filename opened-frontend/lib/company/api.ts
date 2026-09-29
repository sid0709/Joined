import { companyGet, companySend, companySendForm } from "@/lib/me/client";
import { parseISODate, startOfDay } from "@/lib/dates";
import { DEFAULT_CURRENCY } from "@openseat/job-schema";
import type { ActivityItem } from "./activity";
import type { Applicant, ApplicantColumnId, AssistedBy } from "./applicants";
import type { BillingAccount, BillableEvent, Purchase } from "./billing";
import type { CompanyInterview, CompanyInterviewStatus, FaceCheck } from "./interviews";
import type { AssistedPolicy, CompanyJob, CompanyJobStatus, PipelineCounts } from "./jobs";
import { hydrateScreeningAnswers, hydrateScreeningQuestions, hydrateTags } from "@/lib/intake";
import {
  hydrateCustomStages,
  hydrateFeedbackGate,
  hydrateInterviewGuide,
  hydrateScorecardSubmission,
  hydrateScorecardSubmissions,
  hydrateScorecardTemplate,
  type JobPipelineConfig,
  type JobPipelinePut,
  type ScorecardSubmission,
  type ScorecardSubmissionInput,
} from "@/lib/pipeline-eval";
import { CompanyRequestError, isConflictError } from "@/lib/me/client";
import {
  hydrateOptionalUrl,
  hydrateProposedSlots,
  type ProposedSlot,
  type ScheduleMode,
  type SchedulePayload,
} from "@/lib/schedule-join";
import {
  hydrateOfferRecord,
  hydrateOfferTemplates,
  hydrateHirePacket,
  hydrateOfferApproval,
  hydrateOfferEsign,
  type HirePacket,
  type HirePacketInput,
  type OfferApproval,
  type OfferEsign,
  type OfferPatch,
} from "@/lib/offer-hire";
import type { TeamMember, TeamRole } from "./team";
import {
  hydrateAuditEvent,
  hydrateJobAccess,
  normalizeTeamRole,
  type AuditEvent,
  type AuditListResponse,
  type JobAccessAssignment,
} from "@/lib/rbac";
import type { CompanyPage, CompanyPageWrite } from "./page";
import type { HiringProfile } from "./me";
import {
  hydrateDepartments,
  hydrateJobTemplates,
  hydrateOfficeLocations,
  type JobTemplate,
} from "@/lib/layer-a";

const CENTS_PER_DOLLAR = 100;

type ApiJob = Omit<CompanyJob, "postedOn" | "workplace" | "status" | "policy" | "pipeline"> & {
  postedOn: string;
  workplace: CompanyJob["workplace"];
  status: CompanyJobStatus;
  policy: AssistedPolicy;
  pipeline: PipelineCounts;
};

type ApiApplicant = Omit<Applicant, "appliedOn" | "columnId" | "assisted" | "skills"> & {
  appliedOn: string;
  columnId: ApplicantColumnId;
  assisted: AssistedBy;
  skills?: string[];
};

type ApiInterview = Omit<
  CompanyInterview,
  "date" | "status" | "format" | "faceCheck" | "interviewers"
> & {
  date: string;
  status: CompanyInterviewStatus;
  format: CompanyInterview["format"];
  faceCheck: FaceCheck;
  interviewers?: string[];
};

type ApiEvent = Omit<BillableEvent, "date"> & { date: string };
type ApiPurchase = Omit<Purchase, "date"> & { date: string };
type ApiBilling = Omit<BillingAccount, "events" | "purchases"> & {
  events?: ApiEvent[];
  purchases?: ApiPurchase[];
};

type ApiActivity = Omit<ActivityItem, "when" | "createdAt"> & { createdAt: string };

export type CompanyOverview = {
  jobs: CompanyJob[];
  applicants: Applicant[];
  interviews: CompanyInterview[];
  activity: ActivityItem[];
  billing: BillingAccount;
};

export type CompanyCounts = { openJobs: number; newApplicants: number };

export type CompanySettings = {
  domains: { name: string; verified: boolean }[];
  policy: AssistedPolicy;
  dailyCap: number;
  faceCheck: boolean;
  autoReply: boolean;
  digest: string;
  spendAlert: boolean;
};

type TeamResponse = { members: TeamMember[]; emailDomain: string };

function hydrateTeamMember(member: TeamMember): TeamMember {
  return { ...member, role: normalizeTeamRole(member.role) };
}

function hydrateTeam(body: TeamResponse): TeamResponse {
  return {
    emailDomain: body.emailDomain ?? "",
    members: (body.members ?? []).map(hydrateTeamMember),
  };
}

function hydrateJob(job: ApiJob): CompanyJob {
  return {
    ...job,
    postedOn: new Date(job.postedOn),
    pipeline: job.pipeline ?? emptyPipeline(),
    skills: job.skills ?? [],
    responsibilities: job.responsibilities ?? [],
    requirements: job.requirements ?? [],
    description: job.description ?? "",
    summary: job.summary ?? "",
    currency: job.currency || DEFAULT_CURRENCY,
    payMin: job.payMin ?? 0,
    payMax: job.payMax ?? 0,
    visa: job.visa ?? false,
    seniority: job.seniority ?? "Middle",
    jobId: job.jobId || (job.status === "open" ? job.id : undefined),
    screeningQuestions: hydrateScreeningQuestions(job.screeningQuestions),
    customStages: hydrateCustomStages(job.customStages),
    feedbackGate: job.feedbackGate ? hydrateFeedbackGate(job.feedbackGate) : undefined,
    scorecardTemplate: hydrateScorecardTemplate(job.scorecardTemplate) ?? undefined,
    interviewGuide: hydrateInterviewGuide(job.interviewGuide) ?? undefined,
    offerTemplates: hydrateOfferTemplates(job.offerTemplates),
    department: job.department?.trim() || job.team || undefined,
    closedAt: job.closedAt || undefined,
    closeReason: job.closeReason?.trim() || undefined,
  };
}

function hydrateApplicant(person: ApiApplicant): Applicant {
  return {
    ...person,
    appliedOn: new Date(person.appliedOn),
    skills: person.skills ?? [],
    jobTitle: person.jobTitle || "—",
    screeningAnswers: hydrateScreeningAnswers(person.screeningAnswers),
    tags: hydrateTags(person.tags),
    referralSource: person.referralSource || undefined,
    consentAt: person.consentAt || undefined,
    consentVersion: person.consentVersion || undefined,
    userId: person.userId || undefined,
    interviewerIds: Array.isArray(person.interviewerIds)
      ? person.interviewerIds.map(String).filter(Boolean)
      : undefined,
    offer: hydrateOfferRecord(person.offer),
  };
}

function hydrateInterviewDate(raw: string | undefined): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return parseISODate(raw);
  // Awaiting rounds have no locked day yet — keep them off the day calendar.
  return startOfDay(new Date(0));
}

function hydrateScheduleMode(raw: string | undefined | null): ScheduleMode | undefined {
  if (raw === "fixed" || raw === "propose" || raw === "self_schedule") return raw;
  return undefined;
}

function hydrateInterview(item: ApiInterview): CompanyInterview {
  return {
    ...item,
    date: hydrateInterviewDate(item.date),
    interviewers: item.interviewers ?? [],
    jobTitle: item.jobTitle || "—",
    where: hydrateOptionalUrl(item.where),
    meetingUrl: hydrateOptionalUrl(item.meetingUrl),
    mode: hydrateScheduleMode(item.mode),
    selfScheduleUrl: hydrateOptionalUrl(item.selfScheduleUrl),
    proposedSlots: hydrateProposedSlots(item.proposedSlots),
  };
}

function hydrateBilling(billing: ApiBilling): BillingAccount {
  return {
    ...billing,
    events: (billing.events ?? []).map((event) => ({ ...event, date: new Date(event.date) })),
    purchases: (billing.purchases ?? []).map((purchase) => ({
      ...purchase,
      date: new Date(purchase.date),
    })),
  };
}

function hydrateActivity(item: ApiActivity): ActivityItem {
  const createdAt = new Date(item.createdAt);
  return { ...item, createdAt, when: "" };
}

function emptyPipeline(): PipelineCounts {
  return { new: 0, screening: 0, interview: 0, offer: 0 };
}

export async function fetchOverview(): Promise<CompanyOverview> {
  const body = await companyGet<{
    jobs: ApiJob[];
    applicants: ApiApplicant[];
    interviews: ApiInterview[];
    activity: ApiActivity[];
    billing: ApiBilling;
  }>("/overview");
  return {
    jobs: body.jobs.map(hydrateJob),
    applicants: body.applicants.map(hydrateApplicant),
    interviews: body.interviews.map(hydrateInterview),
    activity: body.activity.map(hydrateActivity),
    billing: hydrateBilling(body.billing),
  };
}

export function fetchJobs() {
  return companyGet<{ jobs: ApiJob[] }>("/jobs").then((body) => body.jobs.map(hydrateJob));
}

export function createJob(input: Record<string, unknown>) {
  return companySend<ApiJob>("/jobs", "POST", input).then(hydrateJob);
}

export function fetchJob(id: string) {
  return companyGet<ApiJob>(`/jobs/${encodeURIComponent(id)}`).then(hydrateJob);
}

export function updateJob(id: string, input: Record<string, unknown>) {
  return companySend<ApiJob>(`/jobs/${encodeURIComponent(id)}`, "PUT", input).then(hydrateJob);
}

export function parseJobDescription(description: string) {
  return companySend<{
    title: string;
    team: string;
    seniority: CompanyJob["seniority"];
    location: string;
    workplace: CompanyJob["workplace"];
    payMin: number;
    payMax: number;
    currency: string;
    visa: boolean;
    summary: string;
    skills: string[];
    responsibilities: string[];
    requirements: string[];
    description: string;
  }>("/jobs/parse", "POST", { description }).then((draft) => ({
    ...draft,
    skills: draft.skills ?? [],
    responsibilities: draft.responsibilities ?? [],
    requirements: draft.requirements ?? [],
    description: draft.description ?? "",
    currency: draft.currency || DEFAULT_CURRENCY,
    payMin: draft.payMin ?? 0,
    payMax: draft.payMax ?? 0,
  }));
}

export function fetchJobTeams() {
  return companyGet<{ teams: string[] }>("/job-teams").then((body) => body.teams ?? []);
}

export function saveJobTeams(teams: string[], rename?: { from: string; to: string }) {
  return companySend<{ teams: string[] }>("/job-teams", "PUT", { teams, rename }).then(
    (body) => body.teams ?? [],
  );
}

export function setJobStatus(
  id: string,
  status: CompanyJobStatus,
  options?: { closeReason?: string; notifyOnClose?: boolean },
) {
  return companySend<ApiJob>(`/jobs/${id}`, "PATCH", {
    status,
    ...(status === "closed"
      ? {
          closeReason: options?.closeReason,
          notifyOnClose: options?.notifyOnClose ?? true,
        }
      : {}),
  }).then(hydrateJob);
}

const JOB_TEMPLATES_KEY = "openseat.company.job-templates";
const OFFICE_LOCATIONS_KEY = "openseat.company.office-locations";

function readLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / private mode — ignore; API soft-fail still applies.
  }
}

/** Job post templates — Einstein soft-fails to localStorage. */
export function fetchJobTemplates() {
  return companyGet<{ templates?: JobTemplate[] }>("/job-templates")
    .then((body) => hydrateJobTemplates(body.templates))
    .catch(() => hydrateJobTemplates(readLocalJson<JobTemplate[]>(JOB_TEMPLATES_KEY, [])));
}

export function saveJobTemplates(templates: JobTemplate[]) {
  const next = hydrateJobTemplates(templates);
  writeLocalJson(JOB_TEMPLATES_KEY, next);
  return companySend<{ templates?: JobTemplate[] }>("/job-templates", "PUT", {
    templates: next,
  })
    .then((body) => hydrateJobTemplates(body.templates ?? next))
    .catch(() => next);
}

/**
 * Departments catalog. Prefers /departments; falls back to /job-teams then [].
 * Same strings as CompanyJob.team until Einstein splits the fields.
 */
export function fetchDepartments() {
  return companyGet<{ departments?: string[] }>("/departments")
    .then((body) => hydrateDepartments(body.departments))
    .catch(() =>
      companyGet<{ teams?: string[] }>("/job-teams")
        .then((body) => hydrateDepartments(body.teams))
        .catch(() => [] as string[]),
    );
}

export function saveDepartments(departments: string[], rename?: { from: string; to: string }) {
  const next = hydrateDepartments(departments);
  return companySend<{ departments?: string[]; teams?: string[] }>("/departments", "PUT", {
    departments: next,
    rename,
  })
    .then((body) => hydrateDepartments(body.departments ?? body.teams ?? next))
    .catch(() =>
      // Mirror onto job-teams so existing team pickers stay in sync.
      saveJobTeams(next, rename)
        .then((teams) => hydrateDepartments(teams))
        .catch(() => next),
    );
}

/** Office / hiring cities catalog — soft-fails to localStorage. */
export function fetchOfficeLocations() {
  return companyGet<{ locations?: string[] }>("/office-locations")
    .then((body) => hydrateOfficeLocations(body.locations))
    .catch(() => hydrateOfficeLocations(readLocalJson<string[]>(OFFICE_LOCATIONS_KEY, [])));
}

export function saveOfficeLocations(locations: string[], rename?: { from: string; to: string }) {
  const next = hydrateOfficeLocations(locations);
  writeLocalJson(OFFICE_LOCATIONS_KEY, next);
  return companySend<{ locations?: string[] }>("/office-locations", "PUT", {
    locations: next,
    rename,
  })
    .then((body) => hydrateOfficeLocations(body.locations ?? next))
    .catch(() => next);
}

type ApiPipeline = {
  stages?: JobPipelineConfig["stages"];
  feedbackGate?: JobPipelineConfig["feedbackGate"];
  scorecardTemplate?: JobPipelineConfig["scorecardTemplate"];
  interviewGuide?: JobPipelineConfig["interviewGuide"];
};

function hydratePipeline(raw: ApiPipeline): JobPipelineConfig {
  return {
    stages: hydrateCustomStages(raw.stages),
    feedbackGate: hydrateFeedbackGate(raw.feedbackGate),
    scorecardTemplate: hydrateScorecardTemplate(raw.scorecardTemplate ?? null),
    interviewGuide: hydrateInterviewGuide(raw.interviewGuide ?? null),
  };
}

/** GET /v1/company/jobs/:id/pipeline — custom stages + eval config. */
export function fetchJobPipeline(jobId: string) {
  return companyGet<ApiPipeline>(`/jobs/${encodeURIComponent(jobId)}/pipeline`).then(
    hydratePipeline,
  );
}

/** PUT /v1/company/jobs/:id/pipeline — partial; omitted keys stay unchanged. */
export function saveJobPipeline(jobId: string, input: JobPipelinePut) {
  const body: Record<string, unknown> = {};
  if (input.stages !== undefined) body.stages = input.stages;
  if (input.feedbackGate !== undefined) body.feedbackGate = input.feedbackGate;
  if (input.scorecardTemplate !== undefined) body.scorecardTemplate = input.scorecardTemplate;
  if (input.interviewGuide !== undefined) body.interviewGuide = input.interviewGuide;
  return companySend<ApiPipeline>(`/jobs/${encodeURIComponent(jobId)}/pipeline`, "PUT", body).then(
    hydratePipeline,
  );
}

type ApiScorecard = ScorecardSubmission & { submittedAt: string };

/** GET /v1/company/applicants/:id/scorecards — bare array from Einstein. */
export function fetchApplicantScorecards(applicantId: string) {
  return companyGet<ApiScorecard[]>(
    `/applicants/${encodeURIComponent(applicantId)}/scorecards`,
  ).then((body) => hydrateScorecardSubmissions(body));
}

/** POST /v1/company/applicants/:id/scorecards */
export function submitApplicantScorecard(applicantId: string, input: ScorecardSubmissionInput) {
  return companySend<ApiScorecard>(
    `/applicants/${encodeURIComponent(applicantId)}/scorecards`,
    "POST",
    input,
  ).then((raw) => {
    const saved = hydrateScorecardSubmission(raw);
    if (!saved) throw new CompanyRequestError("Invalid scorecard response", 500);
    return saved;
  });
}

/** Toast copy for stage-move failures — keep 409 gate reasons visible. */
export function stageMoveErrorMessage(error: unknown): string {
  if (isConflictError(error)) {
    return error.message || "Feedback required before advancing this candidate.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Could not move this candidate.";
}

export function fetchApplicants() {
  return companyGet<{ applicants: ApiApplicant[] }>("/applicants").then((body) =>
    body.applicants.map(hydrateApplicant),
  );
}

export function moveApplicant(
  id: string,
  columnId: ApplicantColumnId,
  notes?: string,
  rating?: number,
  tags?: string[],
  interviewerIds?: string[],
  offer?: OfferPatch,
) {
  return companySend<ApiApplicant>(`/applicants/${id}`, "PATCH", {
    columnId,
    notes: notes ?? "",
    rating,
    tags: tags ?? undefined,
    interviewerIds: interviewerIds ?? undefined,
    offer: offer ?? undefined,
  }).then(hydrateApplicant);
}

/** Sparse offer update without forcing a column move. */
export function patchApplicantOffer(id: string, offer: OfferPatch, columnId?: ApplicantColumnId) {
  return companySend<ApiApplicant>(`/applicants/${id}`, "PATCH", {
    offer,
    ...(columnId ? { columnId } : {}),
  }).then(hydrateApplicant);
}

/** POST /v1/company/applicants/:id/offer/approvals — light internal approval. */
export function requestOfferApproval(
  applicantId: string,
  body: { note?: string; approverIds?: string[] },
) {
  return companySend<OfferApproval>(
    `/applicants/${encodeURIComponent(applicantId)}/offer/approvals`,
    "POST",
    body,
  ).then((raw) => {
    const approval = hydrateOfferApproval(raw);
    if (!approval) throw new CompanyRequestError("Invalid approval response", 500);
    return approval;
  });
}

/** PATCH /v1/company/applicants/:id/offer/approvals/:approvalId */
export function decideOfferApproval(
  applicantId: string,
  approvalId: string,
  body: { status: "approved" | "rejected"; note?: string },
) {
  return companySend<OfferApproval>(
    `/applicants/${encodeURIComponent(applicantId)}/offer/approvals/${encodeURIComponent(approvalId)}`,
    "PATCH",
    body,
  ).then((raw) => {
    const approval = hydrateOfferApproval(raw);
    if (!approval) throw new CompanyRequestError("Invalid approval response", 500);
    return approval;
  });
}

/** POST /v1/company/applicants/:id/offer/esign — first-party OpenSeat sign URL. */
export function createOfferEsign(applicantId: string, body?: { documentTitle?: string }) {
  return companySend<OfferEsign>(
    `/applicants/${encodeURIComponent(applicantId)}/offer/esign`,
    "POST",
    body ?? {},
  ).then((raw) => {
    const esign = hydrateOfferEsign(raw);
    if (!esign) throw new CompanyRequestError("Invalid e-sign response", 500);
    return esign;
  });
}

/** POST /v1/company/applicants/:id/hire-packet — draft onboarding checklist. */
export function createHirePacket(applicantId: string, body?: HirePacketInput) {
  return companySend<HirePacket>(
    `/applicants/${encodeURIComponent(applicantId)}/hire-packet`,
    "POST",
    body ?? {},
  ).then((raw) => {
    const packet = hydrateHirePacket(raw);
    if (!packet) throw new CompanyRequestError("Invalid hire packet response", 500);
    return packet;
  });
}

/** Toast copy for offer/hire API failures. */
export function offerHireErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Could not update this offer.";
}

/** PUT job fields including offerTemplates (Einstein create/update/GET). */
export function jobWritePayload(
  job: CompanyJob,
  extras?: { offerTemplates?: import("@/lib/offer-hire").OfferTemplate[] },
): Record<string, unknown> {
  const status = job.status === "closed" ? "paused" : job.status;
  return {
    title: job.title,
    team: job.team,
    seniority: job.seniority,
    location: job.location,
    workplace: job.workplace,
    payMin: job.payMin,
    payMax: job.payMax,
    currency: job.currency,
    visa: job.visa,
    summary: job.summary,
    skills: job.skills ?? [],
    responsibilities: job.responsibilities ?? [],
    requirements: job.requirements ?? [],
    description: job.description ?? "",
    screeningQuestions: job.screeningQuestions ?? [],
    policy: job.policy,
    dailyCap: job.dailyCap,
    status,
    offerTemplates: extras?.offerTemplates ?? job.offerTemplates ?? [],
  };
}

/** Persist offer letter templates on the job via PUT /v1/company/jobs/:id. */
export function saveJobOfferTemplates(
  job: CompanyJob,
  offerTemplates: import("@/lib/offer-hire").OfferTemplate[],
) {
  return updateJob(job.id, jobWritePayload(job, { offerTemplates }));
}

export function fetchInterviews() {
  return companyGet<{ interviews: ApiInterview[] }>("/interviews").then((body) =>
    body.interviews.map(hydrateInterview),
  );
}

export function scheduleInterview(input: SchedulePayload) {
  return companySend<ApiInterview>("/interviews", "POST", {
    applicationId: input.applicationId,
    round: input.round,
    date: input.date,
    start: input.start,
    end: input.end,
    format: input.format,
    interviewers: input.interviewers,
    where: input.where ?? input.meetingUrl,
    meetingUrl: input.meetingUrl ?? input.where,
    mode: input.mode,
    proposedSlots: input.proposedSlots,
    selfSchedule: input.selfSchedule,
  }).then(hydrateInterview);
}

/** PATCH /v1/company/interviews/:id — attendance, join fields, re-offer, or lock slot. */
export type InterviewPatch = {
  status?: "attended" | "no-show";
  where?: string;
  meetingUrl?: string;
  proposedSlots?: ProposedSlot[];
  date?: string;
  start?: string;
  end?: string;
};

export function patchInterview(id: string, patch: InterviewPatch) {
  return companySend<ApiInterview>(`/interviews/${encodeURIComponent(id)}`, "PATCH", patch).then(
    hydrateInterview,
  );
}

export function setAttendance(id: string, status: "attended" | "no-show") {
  return patchInterview(id, { status });
}

/** Lock awaiting → scheduled with a concrete date/start/end. */
export function lockInterviewSlot(id: string, slot: ProposedSlot) {
  return patchInterview(id, { date: slot.date, start: slot.start, end: slot.end });
}

/** Re-offer proposedSlots while the round is still awaiting. */
export function reofferInterviewSlots(id: string, proposedSlots: ProposedSlot[]) {
  return patchInterview(id, { proposedSlots });
}

export function fetchBilling() {
  return companyGet<ApiBilling>("/billing").then(hydrateBilling);
}

export function purchaseBalance(dollars: number) {
  return companySend<ApiBilling>("/billing/purchase", "POST", {
    amountCents: Math.round(dollars * CENTS_PER_DOLLAR),
  }).then(hydrateBilling);
}

export function fetchTeam() {
  return companyGet<TeamResponse>("/team").then(hydrateTeam);
}

export function inviteTeammate(email: string, role: TeamRole) {
  // Einstein should accept hiring_manager / interviewer / finance directly.
  // TODO(einstein): enforce team.invite server-side; reject unknown roles with 400.
  return companySend<TeamResponse>("/team", "POST", { email, role }).then(hydrateTeam);
}

export function setTeammateRole(id: string, role: TeamRole) {
  // TODO(einstein): enforce team.manage_roles; append audit role.changed.
  return companySend<{ ok: boolean }>(`/team/${id}`, "PATCH", { role });
}

export function removeTeammate(id: string) {
  return companySend<void>(`/team/${id}`, "DELETE");
}

export function transferOwnership(userId: string) {
  return companySend<{ ok: boolean }>("/team/transfer", "POST", { userId });
}

export function fetchSettings() {
  return companyGet<CompanySettings>("/settings");
}

export function saveSettings(input: CompanySettings) {
  return companySend<CompanySettings>("/settings", "PUT", input);
}

export function fetchCompanyPage() {
  return companyGet<CompanyPage>("/page");
}

export function saveCompanyPage(input: CompanyPageWrite) {
  return companySend<CompanyPage>("/page", "PUT", input);
}

export function uploadCompanyLogo(file: File) {
  const body = new FormData();
  body.append("logo", file);
  return companySendForm<CompanyPage>("/page/logo", "POST", body);
}

export function deleteCompanyLogo() {
  return companySend<CompanyPage>("/page/logo", "DELETE");
}

export function fetchHiringProfile() {
  return companyGet<HiringProfile & { name: string }>("/profile");
}

export function saveHiringProfile(input: HiringProfile & { name: string }) {
  return companySend<HiringProfile & { name: string }>("/profile", "PUT", input);
}

/** Company audit trail — Einstein GET scaffold. Soft-fails empty. */
export function fetchTeamAudit(params?: { cursor?: string; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.cursor) query.set("cursor", params.cursor);
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.size ? `?${query}` : "";
  return companyGet<AuditListResponse>(`/team/audit${suffix}`)
    .then((body) => ({
      events: (body.events ?? []).map((event) => hydrateAuditEvent(event)),
      nextCursor: body.nextCursor,
    }))
    .catch(() => ({ events: [] as AuditEvent[], nextCursor: undefined }));
}

/** Per-job access overrides — Einstein GET scaffold. Soft-fails empty. */
export function fetchJobAccess(jobId: string) {
  return companyGet<{ assignments?: JobAccessAssignment[] }>(`/jobs/${jobId}/access`)
    .then((body) => hydrateJobAccess(jobId, body))
    .catch(() => hydrateJobAccess(jobId, { assignments: [] }));
}

/** Persist per-job access — Einstein PUT scaffold. Soft-fails local echo. */
export function saveJobAccess(jobId: string, assignments: JobAccessAssignment[]) {
  // TODO(einstein): enforce jobs.edit / team.manage_roles; append job_access.updated.
  return companySend<{ assignments?: JobAccessAssignment[] }>(`/jobs/${jobId}/access`, "PUT", {
    assignments,
  })
    .then((body) => hydrateJobAccess(jobId, body))
    .catch(() => hydrateJobAccess(jobId, { assignments }));
}
