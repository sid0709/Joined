/**
 * Layer D — Schedule & Join (scaffold) shapes.
 *
 * Einstein contract (persist + return these fields; UI scaffolds against them):
 *
 * POST /v1/company/interviews
 *   Existing: applicationId, round, date, start, end, format, interviewers[]
 *   body.where?: string              // Meet/Zoom/built-in URL or location
 *   body.meetingUrl?: string         // preferred join URL (alias of where for video)
 *   body.mode?: "fixed" | "propose" | "self_schedule"
 *   body.proposedSlots?: ProposedSlot[]  // when mode=propose; status → awaiting
 *   body.selfSchedule?: boolean      // when true, create awaiting + selfScheduleUrl
 *   When mode is propose/self_schedule and no fixed slot is locked yet,
 *   response.status should be "awaiting". Fixed schedule remains "scheduled".
 *
 * GET /v1/company/interviews (and overview)
 *   CompanyInterview.where?: string          // join URL or onsite/phone detail
 *   CompanyInterview.meetingUrl?: string     // if distinct from where
 *   CompanyInterview.selfScheduleUrl?: string
 *   CompanyInterview.proposedSlots?: ProposedSlot[]
 *
 * PATCH /v1/company/interviews/:id
 *   Existing attendance: { status: "attended" | "no-show" }
 *   Also accept (scaffold):
 *     body.where / body.meetingUrl
 *     body.proposedSlots (employer re-offers times while awaiting)
 *     body.date/start/end when locking a slot from awaiting → scheduled
 *
 * GET /v1/company/profile
 *   HiringProfile already returns meetingLink, interviewDays, dayStart,
 *   dayEnd, interviewLength, buffer, timeZone — used client-side to
 *   propose slots until Einstein owns calendar free/busy.
 *
 * Out of scope here: RBAC (F), analytics (G), SSO, Scoutwell. Offers: see offer-hire.ts.
 */

import type { HiringProfile } from "@/lib/company/me";
import { formatISODate, startOfDay } from "@/lib/dates";

export type ScheduleMode = "fixed" | "propose" | "self_schedule";

export type ProposedSlot = {
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string; // HH:mm
};

export type SchedulePayload = {
  applicationId: string;
  round: string;
  date: string;
  start: string;
  end: string;
  format: "video" | "onsite" | "phone";
  interviewers?: string[];
  /** Join URL or location; Einstein should persist on interview.where. */
  where?: string;
  meetingUrl?: string;
  mode?: ScheduleMode;
  proposedSlots?: ProposedSlot[];
  selfSchedule?: boolean;
};

export type JoinableInterview = {
  format: "video" | "onsite" | "phone";
  where?: string;
  meetingUrl?: string;
};

export const MAX_PROPOSED_SLOTS = 5;
export const DEFAULT_SLOT_HORIZON_DAYS = 14;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function isHttpUrl(value: string | undefined | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed);
}

/** Prefer meetingUrl, then where when it is a URL, then hiring-profile meetingLink. */
export function resolveJoinUrl(
  interview: JoinableInterview,
  fallbackMeetingLink?: string | null,
): string | null {
  if (interview.format !== "video") return null;
  if (isHttpUrl(interview.meetingUrl)) return interview.meetingUrl!.trim();
  if (isHttpUrl(interview.where)) return interview.where!.trim();
  if (isHttpUrl(fallbackMeetingLink)) return fallbackMeetingLink!.trim();
  return null;
}

export function openJoinUrl(url: string) {
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function compareTime(a: string, b: string) {
  return a.localeCompare(b);
}

/**
 * Build proposed slots from hiring-profile availability (no calendar free/busy yet).
 * Skips weekends not in interviewDays; walks dayStart→dayEnd by interviewLength+buffer.
 */
export function proposeSlotsFromAvailability(
  profile: Pick<
    HiringProfile,
    "interviewDays" | "dayStart" | "dayEnd" | "interviewLength" | "buffer"
  >,
  options?: { from?: Date; count?: number; horizonDays?: number },
): ProposedSlot[] {
  const count = Math.min(options?.count ?? MAX_PROPOSED_SLOTS, MAX_PROPOSED_SLOTS);
  const horizon = options?.horizonDays ?? DEFAULT_SLOT_HORIZON_DAYS;
  const length = Math.max(15, Number.parseInt(profile.interviewLength || "45", 10) || 45);
  const buffer = Math.max(0, Number.parseInt(profile.buffer || "0", 10) || 0);
  const step = length + buffer;
  const allowed = new Set(
    (profile.interviewDays?.length
      ? profile.interviewDays
      : ["mon", "tue", "wed", "thu", "fri"]
    ).map((day) => day.toLowerCase()),
  );
  const dayStart = /^\d{2}:\d{2}$/.test(profile.dayStart) ? profile.dayStart : "09:00";
  const dayEnd = /^\d{2}:\d{2}$/.test(profile.dayEnd) ? profile.dayEnd : "17:00";
  const from = startOfDay(options?.from ?? new Date());
  // Start proposing from tomorrow so same-day rush slots stay manual.
  from.setDate(from.getDate() + 1);

  const slots: ProposedSlot[] = [];
  for (let offset = 0; offset < horizon && slots.length < count; offset += 1) {
    const day = new Date(from);
    day.setDate(from.getDate() + offset);
    const key = DAY_KEYS[day.getDay()];
    if (!allowed.has(key)) continue;

    let cursor = dayStart;
    while (compareTime(addMinutes(cursor, length), dayEnd) <= 0 && slots.length < count) {
      slots.push({
        date: formatISODate(day),
        start: cursor,
        end: addMinutes(cursor, length),
      });
      cursor = addMinutes(cursor, step);
      if (compareTime(cursor, dayEnd) >= 0) break;
    }
  }
  return slots;
}

export function hydrateProposedSlots(raw: ProposedSlot[] | undefined | null): ProposedSlot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item) =>
        item &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
        /^\d{2}:\d{2}$/.test(item.start) &&
        /^\d{2}:\d{2}$/.test(item.end),
    )
    .slice(0, MAX_PROPOSED_SLOTS);
}

export function hydrateOptionalUrl(raw: string | undefined | null): string | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 500) : undefined;
}

/** Scaffold self-schedule URL when Einstein has not minted one yet. */
export function scaffoldSelfScheduleUrl(interviewId: string, origin?: string): string {
  const base =
    origin || (typeof window !== "undefined" ? window.location.origin : "https://openseat.app");
  return `${base}/schedule/${encodeURIComponent(interviewId)}`;
}

export function slotLabel(slot: ProposedSlot): string {
  return `${slot.date} · ${slot.start}–${slot.end}`;
}
