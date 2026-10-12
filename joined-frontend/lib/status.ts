import type { UptimeDay, UptimeTone } from "sid-ui";
import { joinedApiUrl } from "@/lib/config";

/** GET /v1/status — backend-core/statuspage Page. */
const STATUS_PATH = "/v1/status";

/** Matches backend-core/statuspage PageTTL: the page is rebuilt at most this often. */
export const STATUS_REVALIDATE_SECONDS = 30;

export type ComponentStatus =
  "operational" | "degraded" | "partial_outage" | "major_outage" | "unknown";
export type IncidentPhase = "investigating" | "identified" | "monitoring" | "resolved";
export type IncidentImpact = "none" | "minor" | "major" | "critical";

export type StatusDay = {
  date: string;
  uptime: number | null;
  tone: UptimeTone;
  incidents?: string[];
};

export type StatusComponent = {
  id: string;
  name: string;
  description: string;
  status: ComponentStatus;
  uptime: number | null;
  days: StatusDay[];
};

export type StatusUpdate = { status: IncidentPhase; message: string; at: string };

export type StatusIncident = {
  id: string;
  title: string;
  impact: IncidentImpact;
  status: IncidentPhase;
  components: string[];
  updates: StatusUpdate[];
  createdAt: string;
  resolvedAt?: string;
};

export type StatusPage = {
  status: ComponentStatus;
  live: boolean;
  updatedAt: string;
  components: StatusComponent[];
  activeIncidents: StatusIncident[] | null;
  history: { date: string; incidents: StatusIncident[] }[];
};

/** The page's data, or null when the API cannot be reached: itself a sign of an outage. */
export async function loadStatus(): Promise<StatusPage | null> {
  try {
    const response = await fetch(`${joinedApiUrl()}${STATUS_PATH}`, {
      next: { revalidate: STATUS_REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;
    return (await response.json()) as StatusPage;
  } catch {
    return null;
  }
}

export const STATUS_LABEL: Record<ComponentStatus, string> = {
  operational: "Operational",
  degraded: "Degraded performance",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
  unknown: "Not measured",
};

export const STATUS_BADGE: Record<ComponentStatus, "success" | "warning" | "error" | "neutral"> = {
  operational: "success",
  degraded: "warning",
  partial_outage: "warning",
  major_outage: "error",
  unknown: "neutral",
};

export const PHASE_LABEL: Record<IncidentPhase, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

const LOCALE = "en";
const PERCENT = 100;
/** Days and times on the page are UTC, the same days the server counts uptime in. */
const TIME_ZONE = "UTC";

const dayFormat = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: TIME_ZONE,
});
// Date and time are formatted apart and joined here: ICU builds differ on the
// joiner ("Oct 11, 3:04 PM" on Linux, "Oct 11 at 3:04 PM" on macOS).
const monthDayFormat = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  day: "numeric",
  timeZone: TIME_ZONE,
});
const clockFormat = new Intl.DateTimeFormat(LOCALE, {
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

/** "2026-10-11" → "Oct 11, 2026". */
export function formatDay(date: string) {
  return dayFormat.format(new Date(`${date}T00:00:00Z`));
}

/** An instant as "Oct 11, 3:04 PM UTC". */
export function formatTime(at: string) {
  const date = new Date(at);
  return `${monthDayFormat.format(date)}, ${clockFormat.format(date)} ${TIME_ZONE}`;
}

/** Uptime share as "99.98%"; a perfect or empty record reads plainly. */
export function formatUptime(uptime: number | null) {
  if (uptime == null) return "No data yet";
  const percent = uptime * PERCENT;
  if (percent === PERCENT) return "100%";
  return `${(Math.floor(percent * PERCENT) / PERCENT).toFixed(2)}%`;
}

/** The bars for one component, with each day's figures in the tip. */
export function uptimeDays(component: StatusComponent): UptimeDay[] {
  return component.days.map((day) => {
    const details: string[] = [];
    if (day.uptime != null) details.push(`${formatUptime(day.uptime)} uptime`);
    details.push(...(day.incidents ?? []));
    return { label: formatDay(day.date), tone: day.tone, details };
  });
}
