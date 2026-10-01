import type { Application } from "@/lib/applications";
import { hydrateApplication } from "@/lib/applications";
import type { Interview } from "@/lib/interviews";
import { hydrateInterview } from "@/lib/interviews";
import type { MailThread } from "@/lib/messages";
import { joinedMe } from "@/lib/me/server";
import { normalizeProfile, type Profile } from "@/lib/profile";

export async function loadProfile() {
  const profile = await joinedMe<Profile>("/v1/me/profile");
  return profile ? normalizeProfile(profile) : null;
}

export async function loadSavedJobIds() {
  const body = await joinedMe<{ jobIds?: string[] }>("/v1/me/saved-jobs");
  return body?.jobIds ?? [];
}

export async function loadAppliedJobIds() {
  const body = await joinedMe<{ appliedJobIds?: string[] }>("/v1/me/applications");
  return body?.appliedJobIds ?? [];
}

export async function loadUnread() {
  const body = await joinedMe<{ unread?: number }>("/v1/me/unread");
  return body?.unread ?? 0;
}

export async function loadCompanyUnread() {
  const body = await joinedMe<{ unread?: number }>("/v1/company/unread");
  return body?.unread ?? 0;
}

export async function loadApplications() {
  const body = await joinedMe<{ applications?: Application[] }>("/v1/me/applications");
  return (body?.applications ?? []).map(hydrateApplication);
}

export async function loadInterviews() {
  try {
    await joinedMe("/v1/me/calendar/google/sync", { method: "POST" });
  } catch {
    /* Calendar may be disconnected or unconfigured. */
  }
  const body = await joinedMe<{ interviews?: Interview[] }>("/v1/me/interviews");
  return (body?.interviews ?? []).map(hydrateInterview);
}

export async function loadThreads() {
  const body = await joinedMe<{ threads?: MailThread[] }>("/v1/me/threads");
  return body?.threads ?? [];
}

export async function loadCompanyThreads() {
  const body = await joinedMe<{ threads?: MailThread[] }>("/v1/company/threads");
  return body?.threads ?? [];
}

export async function loadCalendar() {
  return joinedMe<{ connected: boolean; email?: string }>("/v1/me/calendar");
}
