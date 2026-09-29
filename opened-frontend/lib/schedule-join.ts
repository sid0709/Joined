/**
 * Layer D — Schedule & Join shapes (wired to Einstein company interviews API).
 *
 * POST /v1/company/interviews
 *   Existing: applicationId, round, date, start, end, format, interviewers[]
 *   body.where?: string              // Meet/Zoom/built-in URL or location
 *   body.meetingUrl?: string         // preferred join URL (alias of where for video)
 *   body.mode?: "fixed" | "propose" | "self_schedule"
 *   body.proposedSlots?: ProposedSlot[]  // when mode=propose; status → awaiting
 *   body.selfSchedule?: boolean      // when true, create awaiting + selfScheduleUrl
 *   Propose / self_schedule → status "awaiting". Fixed → "scheduled".
 *   selfScheduleUrl = {FRONTEND_ORIGIN}/schedule/{selfScheduleToken}
 *   selfScheduleToken is 32-byte hex, not the interview id.
 *   selfScheduleExpiresAt is set to 14 days. A zero expiry does not expire.
 *   Links already shared as /schedule/{interviewId} still resolve and accept.
 *
 * GET /v1/company/interviews (and overview)
 *   where, meetingUrl, mode, selfScheduleUrl, selfScheduleExpiresAt, proposedSlots
 *
 * PATCH /v1/company/interviews/:id
 *   { status: "attended" | "no-show" }
 *   where / meetingUrl
 *   proposedSlots (employer re-offers while awaiting)
 *   date+start+end locks awaiting → scheduled
 *
 * GET  /v1/schedule/:key
 * POST /v1/schedule/:key/accept   { date, start, end }
 *   Public (wired in lib/schedule-public.ts + /schedule/:id).
 *   key is the self-schedule token, or a legacy interview id.
 *   Accept locks awaiting → scheduled. When proposedSlots is non-empty the
 *   slot must be one of them. The same slot again is idempotent. A different
 *   slot after lock is 409. An expired awaiting link is 410.
 *   Body omits candidate identity: company, role, round, format, where,
 *   meetingUrl, status, mode, proposedSlots, date, start, end, expiresAt.
 *
 * GET /v1/company/profile
 *   HiringProfile meetingLink / interviewDays / dayStart / dayEnd /
 *   interviewLength / buffer / timeZone — client proposes slots.
 *
 * GET /v1/company/interviews/free-busy?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   Auth: company session, interviews.schedule
 *   200 { blocks: [{ date, start, end }] } busy intervals in the hiring
 *   profile time zone. Not served until interviewer calendar-connect exists.
 *   Do not use the candidate Google calendar (/v1/me/calendar/google/*),
 *   and do not serve hiring-profile hours as free/busy.
 *   400 { error } when from/to are missing, not YYYY-MM-DD, or from is after to.
 *   503 { error, code: "free_busy_not_ready" } until interviewer calendars
 *   are connected. Match code (or status 503 plus that error string).
 *   A hard crash is 500 { error: "could not complete the request" } with no code.
 * Out of scope: SSO, Scoutwell, offers (offer-hire.ts).
 */

import type { HiringProfile } from "@/lib/company/me";
import { formatISODate, startOfDay } from "@/lib/dates";
import { CompanyRequestError } from "@/lib/me/client";

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
  /** Join URL or location; persisted on interview.where. */
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

/** JSON code on GET /v1/company/interviews/free-busy while calendars are disconnected. */
export const FREE_BUSY_NOT_READY = "free_busy_not_ready";

/** True when free/busy answered 503 because interviewer calendar-connect is missing. */
export function isFreeBusyNotReady(error: unknown): error is CompanyRequestError {
  return (
    error instanceof CompanyRequestError &&
    error.status === 503 &&
    error.code === FREE_BUSY_NOT_READY
  );
}

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

/**
 * Scaffold a legacy interview-id URL when the API has not minted a token yet.
 * GET/POST /v1/schedule/:key still accepts this path.
 */
export function scaffoldSelfScheduleUrl(interviewId: string, origin?: string): string {
  const base =
    origin || (typeof window !== "undefined" ? window.location.origin : "https://openseat.app");
  return `${base}/schedule/${encodeURIComponent(interviewId)}`;
}

export function slotLabel(slot: ProposedSlot): string {
  return `${slot.date} · ${slot.start}–${slot.end}`;
}
