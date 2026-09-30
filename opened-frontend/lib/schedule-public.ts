/**
 * Public self-schedule — GET/POST /v1/schedule/:key against Einstein D polish.
 * key is a 32-byte hex selfScheduleToken, or a legacy interview id.
 * No candidate identity in the body. Free/busy stays out of scope.
 */

import { openedApiUrl } from "@/lib/config";
import { CompanyRequestError } from "@/lib/me/client";
import {
  hydrateOptionalUrl,
  hydrateProposedSlots,
  type ProposedSlot,
  type ScheduleMode,
} from "@/lib/schedule-join";

export type PublicScheduleStatus = "awaiting" | "scheduled" | string;

export type PublicSchedule = {
  company: string;
  role: string;
  round: string;
  format: string;
  where?: string;
  meetingUrl?: string;
  status: PublicScheduleStatus;
  mode?: ScheduleMode | string;
  proposedSlots: ProposedSlot[];
  date?: string;
  start?: string;
  end?: string;
  /** ISO expiry while awaiting; omitted when the link does not expire. */
  expiresAt?: string;
};

type ApiPublicSchedule = {
  company?: string;
  role?: string;
  round?: string;
  format?: string;
  where?: string;
  meetingUrl?: string;
  status?: string;
  mode?: string;
  proposedSlots?: ProposedSlot[];
  date?: string;
  start?: string;
  end?: string;
  expiresAt?: string;
};

export type PublicScheduleLoad =
  { ok: true; schedule: PublicSchedule } | { ok: false; status: number; message: string };

function hydrateMode(raw: string | undefined): ScheduleMode | string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed === "fixed" || trimmed === "propose" || trimmed === "self_schedule") return trimmed;
  return trimmed || undefined;
}

function hydratePublicSchedule(raw: ApiPublicSchedule): PublicSchedule {
  const where = raw.where?.trim();
  return {
    company: (raw.company ?? "").trim() || "Company",
    role: (raw.role ?? "").trim() || "Role",
    round: (raw.round ?? "").trim() || "Interview",
    format: (raw.format ?? "").trim() || "video",
    where: where || undefined,
    meetingUrl: hydrateOptionalUrl(raw.meetingUrl),
    status: (raw.status ?? "awaiting").trim() || "awaiting",
    mode: hydrateMode(raw.mode),
    proposedSlots: hydrateProposedSlots(raw.proposedSlots),
    date: raw.date?.trim() || undefined,
    start: raw.start?.trim() || undefined,
    end: raw.end?.trim() || undefined,
    expiresAt: raw.expiresAt?.trim() || undefined,
  };
}

async function readScheduleError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

/** Server-side GET /v1/schedule/:key — token or legacy interview id. */
export async function loadPublicSchedule(key: string): Promise<PublicScheduleLoad> {
  const trimmed = key.trim();
  if (!trimmed) {
    return { ok: false, status: 404, message: "not found" };
  }
  const response = await fetch(
    new URL(`/v1/schedule/${encodeURIComponent(trimmed)}`, `${openedApiUrl()}/`),
    { cache: "no-store" },
  );
  if (!response.ok) {
    const fallback =
      response.status === 410
        ? "this scheduling link has expired"
        : response.status === 404
          ? "not found"
          : "Could not load this schedule link";
    return {
      ok: false,
      status: response.status,
      message: await readScheduleError(response, fallback),
    };
  }
  const body = (await response.json()) as ApiPublicSchedule;
  return { ok: true, schedule: hydratePublicSchedule(body) };
}

/**
 * Browser accept via BFF POST /api/schedule/:key/accept → /v1/schedule/:key/accept.
 * Same slot again is idempotent (200). Other slot after lock → 409. Expired → 410.
 */
export async function acceptPublicSchedule(
  key: string,
  slot: ProposedSlot,
): Promise<PublicSchedule> {
  const response = await fetch(`/api/schedule/${encodeURIComponent(key)}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ date: slot.date, start: slot.start, end: slot.end }),
  });
  const text = await response.text();
  if (!response.ok) {
    let message = "Could not lock that time";
    try {
      const body = JSON.parse(text) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* keep default */
    }
    throw new CompanyRequestError(message, response.status);
  }
  const body = (text ? JSON.parse(text) : {}) as ApiPublicSchedule;
  return hydratePublicSchedule(body);
}

export function isGoneError(error: unknown): error is CompanyRequestError {
  return error instanceof CompanyRequestError && error.status === 410;
}

export function isNotFoundError(error: unknown): error is CompanyRequestError {
  return error instanceof CompanyRequestError && error.status === 404;
}
