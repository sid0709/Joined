import { companyGet, companySend, companySendForm } from "@/lib/me/client";
import { parseISODate } from "@/lib/dates";
import { DEFAULT_CURRENCY } from "@openseat/job-schema";
import type { ActivityItem } from "./activity";
import type { Applicant, ApplicantStage, AssistedBy } from "./applicants";
import type { BillingAccount, BillableEvent, Purchase } from "./billing";
import type { CompanyInterview, CompanyInterviewStatus, FaceCheck } from "./interviews";
import type { AssistedPolicy, CompanyJob, CompanyJobStatus, PipelineCounts } from "./jobs";
import { hydrateScreeningAnswers, hydrateScreeningQuestions, hydrateTags } from "@/lib/intake";
import {
  hydrateCustomStages,
  hydrateFeedbackGate,
  hydrateInterviewGuide,
  hydrateScorecardTemplate,
} from "@/lib/pipeline-eval";
import {
  hydrateOptionalUrl,
  hydrateProposedSlots,
  type SchedulePayload,
} from "@/lib/schedule-join";
import { hydrateOfferRecord, hydrateOfferTemplates, type OfferPatch } from "@/lib/offer-hire";
import type { TeamMember, TeamRole } from "./team";
import type { CompanyPage, CompanyPageWrite } from "./page";
import type { HiringProfile } from "./me";

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
  columnId: ApplicantStage;
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

function hydrateInterview(item: ApiInterview): CompanyInterview {
  return {
    ...item,
    date: parseISODate(item.date),
    interviewers: item.interviewers ?? [],
    jobTitle: item.jobTitle || "—",
    where: hydrateOptionalUrl(item.where),
    meetingUrl: hydrateOptionalUrl(item.meetingUrl),
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

export function setJobStatus(id: string, status: CompanyJobStatus) {
  return companySend<ApiJob>(`/jobs/${id}`, "PATCH", { status }).then(hydrateJob);
}

export function fetchApplicants() {
  return companyGet<{ applicants: ApiApplicant[] }>("/applicants").then((body) =>
    body.applicants.map(hydrateApplicant),
  );
}

export function moveApplicant(
  id: string,
  columnId: ApplicantStage,
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
    // TODO(einstein): accept interviewerIds on PATCH /v1/company/applicants/:id
    interviewerIds: interviewerIds ?? undefined,
    // TODO(einstein): persist OfferPatch on PATCH /v1/company/applicants/:id
    offer: offer ?? undefined,
  }).then(hydrateApplicant);
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
    // TODO(einstein): persist where / meetingUrl / mode / proposedSlots / selfSchedule
    where: input.where ?? input.meetingUrl,
    meetingUrl: input.meetingUrl ?? input.where,
    mode: input.mode,
    proposedSlots: input.proposedSlots,
    selfSchedule: input.selfSchedule,
  }).then(hydrateInterview);
}

export function setAttendance(id: string, status: "attended" | "no-show") {
  return companySend<ApiInterview>(`/interviews/${id}`, "PATCH", { status }).then(hydrateInterview);
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
  return companyGet<TeamResponse>("/team");
}

export function inviteTeammate(email: string, role: TeamRole) {
  return companySend<TeamResponse>("/team", "POST", { email, role });
}

export function setTeammateRole(id: string, role: TeamRole) {
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
