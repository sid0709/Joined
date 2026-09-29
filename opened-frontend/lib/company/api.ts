import { companyGet, companySend, companySendForm } from "@/lib/me/client";
import { parseISODate } from "@/lib/dates";
import type { ActivityItem } from "./activity";
import type { Applicant, ApplicantStage, AssistedBy } from "./applicants";
import type { BillingAccount, BillableEvent, Purchase } from "./billing";
import type { CompanyInterview, CompanyInterviewStatus, FaceCheck } from "./interviews";
import type { AssistedPolicy, CompanyJob, CompanyJobStatus, PipelineCounts } from "./jobs";
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

export type CompanyPage = {
  id: string;
  name: string;
  url?: string;
  logo?: string;
  tagline?: string;
  about?: string;
  industry?: string;
  size?: string;
  founded?: number;
  replyDays?: number;
  headquarters?: string;
  companyType?: string;
  locations?: string;
  specialties?: string[];
  mission?: string;
  values?: { icon: string; title: string; description: string }[];
  leadership?: { name: string; title: string }[];
  benefitCategories?: { label: string; items: string[] }[];
};

type TeamResponse = { members: TeamMember[]; emailDomain: string };

function hydrateJob(job: ApiJob): CompanyJob {
  return { ...job, postedOn: new Date(job.postedOn), pipeline: job.pipeline ?? emptyPipeline() };
}

function hydrateApplicant(person: ApiApplicant): Applicant {
  return {
    ...person,
    appliedOn: new Date(person.appliedOn),
    skills: person.skills ?? [],
    jobTitle: person.jobTitle || "—",
  };
}

function hydrateInterview(item: ApiInterview): CompanyInterview {
  return {
    ...item,
    date: parseISODate(item.date),
    interviewers: item.interviewers ?? [],
    jobTitle: item.jobTitle || "—",
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
) {
  return companySend<ApiApplicant>(`/applicants/${id}`, "PATCH", {
    columnId,
    notes: notes ?? "",
    rating,
  }).then(hydrateApplicant);
}

export function fetchInterviews() {
  return companyGet<{ interviews: ApiInterview[] }>("/interviews").then((body) =>
    body.interviews.map(hydrateInterview),
  );
}

export function scheduleInterview(input: {
  applicationId: string;
  round: string;
  date: string;
  start: string;
  end: string;
  format: CompanyInterview["format"];
}) {
  return companySend<ApiInterview>("/interviews", "POST", input).then(hydrateInterview);
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

export function saveCompanyPage(input: CompanyPage) {
  return companySend<CompanyPage>("/page", "PUT", input);
}

export function pageToWorkspace(page: CompanyPage): Workspace {
  const benefits = (page.benefitCategories ?? []).flatMap((group) => group.items ?? []);
  return {
    id: page.id,
    slug: page.id,
    name: page.name,
    locations: page.locations ?? "",
    about: page.about ?? "",
    industry: page.industry ?? "",
    size: page.size ?? "",
    founded: page.founded ?? 0,
    replyDays: page.replyDays ?? 0,
    tagline: page.tagline ?? "",
    website: page.url ?? "",
    verified: false,
    benefits,
  };
}

export function workspaceToPage(draft: Workspace, current: CompanyPage | null): CompanyPage {
  return {
    ...(current ?? { id: draft.id, name: draft.name }),
    id: draft.id,
    name: draft.name,
    url: draft.website,
    tagline: draft.tagline,
    about: draft.about,
    industry: draft.industry,
    size: draft.size,
    founded: draft.founded,
    replyDays: draft.replyDays,
    locations: draft.locations,
    benefitCategories: draft.benefits.length ? [{ label: "Perks", items: draft.benefits }] : [],
  };
}

export function fetchHiringProfile() {
  return companyGet<HiringProfile & { name: string }>("/profile");
}

export function saveHiringProfile(input: HiringProfile & { name: string }) {
  return companySend<HiringProfile & { name: string }>("/profile", "PUT", input);
}
