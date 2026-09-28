import type { Application } from "@/lib/applications";
import { hydrateApplication } from "@/lib/applications";
import type { Interview } from "@/lib/interviews";
import { hydrateInterview } from "@/lib/interviews";
import type { MailThread } from "@/lib/messages";
import { companyGet, companySend, meGet, meSend } from "@/lib/me/client";
import type { Profile } from "@/lib/profile";

export function saveProfile(patch: Partial<Profile>) {
  return meSend<Profile>("/profile", "PATCH", patch);
}

export function saveJob(jobId: string) {
  return meSend<void>(`/saved-jobs/${encodeURIComponent(jobId)}`, "PUT");
}

export function unsaveJob(jobId: string) {
  return meSend<void>(`/saved-jobs/${encodeURIComponent(jobId)}`, "DELETE");
}

export async function fetchApplications() {
  const body = await meGet<{ applications?: Application[]; appliedJobIds?: string[] }>(
    "/applications",
  );
  return {
    applications: (body.applications ?? []).map(hydrateApplication),
    appliedJobIds: body.appliedJobIds ?? [],
  };
}

export function createApplication(input: {
  jobId?: string;
  title?: string;
  company?: string;
  location?: string;
  resume?: string;
  columnId?: string;
  note?: string;
}) {
  return meSend<Application>("/applications", "POST", input).then(hydrateApplication);
}

export function updateApplication(id: string, patch: { columnId?: string; closedReason?: string }) {
  return meSend<Application>(`/applications/${encodeURIComponent(id)}`, "PATCH", patch).then(
    hydrateApplication,
  );
}

export function removeApplication(id: string) {
  return meSend<void>(`/applications/${encodeURIComponent(id)}`, "DELETE");
}

export async function fetchInterviews() {
  const body = await meGet<{ interviews?: Interview[] }>("/interviews");
  return (body.interviews ?? []).map(hydrateInterview);
}

export function createInterview(input: {
  applicationId: string;
  round: string;
  date: string;
  start: string;
  end: string;
  format: string;
  where?: string;
}) {
  return meSend<Interview>("/interviews", "POST", input).then(hydrateInterview);
}

export function updateInterview(id: string, patch: Partial<Interview>) {
  return meSend<Interview>(`/interviews/${encodeURIComponent(id)}`, "PATCH", patch).then(
    hydrateInterview,
  );
}

export function fetchCalendar() {
  return meGet<{ connected: boolean; email?: string }>("/calendar");
}

export function startGoogleCalendar() {
  return meGet<{ url: string }>("/calendar/google/start");
}

export function disconnectGoogleCalendar() {
  return meSend<void>("/calendar/google", "DELETE");
}

export function syncGoogleCalendar() {
  return meSend<{ interviews?: Interview[] }>("/calendar/google/sync", "POST").then((body) => ({
    interviews: (body.interviews ?? []).map(hydrateInterview),
  }));
}

export function fetchThreads() {
  return meGet<{ threads: MailThread[] }>("/threads").then((body) => body.threads ?? []);
}

export function fetchThread(id: string) {
  return meGet<MailThread>(`/threads/${encodeURIComponent(id)}`);
}

export function sendThreadMessage(id: string, body: string) {
  return meSend<MailThread["messages"][number]>(
    `/threads/${encodeURIComponent(id)}/messages`,
    "POST",
    {
      body,
    },
  );
}

export function fetchCompanyThreads() {
  return companyGet<{ threads: MailThread[] }>("/threads").then((body) => body.threads ?? []);
}

export function fetchCompanyThread(id: string) {
  return companyGet<MailThread>(`/threads/${encodeURIComponent(id)}`);
}

export function sendCompanyMessage(id: string, body: string) {
  return companySend<MailThread["messages"][number]>(
    `/threads/${encodeURIComponent(id)}/messages`,
    "POST",
    { body },
  );
}

export function fetchSavedJobIds() {
  return meGet<{ jobIds?: string[] }>("/saved-jobs").then((body) => body.jobIds ?? []);
}
