import type { BadgeVariant, KanbanColumn } from "@joined/design-system";
import { parseJSONDate } from "@/lib/me/dates";

export type ApplicationStage = "saved" | "applied" | "screening" | "interview" | "offer" | "closed";
export type ApplicationSource = "direct" | "scouted";
export type ClosedReason = "Rejected" | "Withdrawn" | "No response";

export type ApplicationEvent = {
  id: string;
  label: string;
  date: Date;
};

export type Application = {
  id: string;
  /** KanbanBoard reads the stage as its column. */
  columnId: ApplicationStage;
  jobId: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  source: ApplicationSource;
  resume: string;
  match: number;
  updated: Date;
  nextStep?: string;
  closedReason?: ClosedReason;
  activity: ApplicationEvent[];
};

export type StageMeta = {
  id: ApplicationStage;
  title: string;
  badge: BadgeVariant;
  description: string;
};

export const STAGES: StageMeta[] = [
  { id: "saved", title: "Saved", badge: "neutral", description: "Bookmarked, not applied yet." },
  { id: "applied", title: "Applied", badge: "info", description: "Sent and waiting to hear back." },
  {
    id: "screening",
    title: "Screening",
    badge: "purple",
    description: "A recruiter is reviewing.",
  },
  {
    id: "interview",
    title: "Interviewing",
    badge: "warning",
    description: "At least one round scheduled.",
  },
  { id: "offer", title: "Offer", badge: "success", description: "An offer is on the table." },
  {
    id: "closed",
    title: "Closed",
    badge: "error",
    description: "Rejected, withdrawn, or no reply.",
  },
];

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((stage) => [stage.id, stage])) as Record<
  ApplicationStage,
  StageMeta
>;

export const BOARD_COLUMNS: KanbanColumn[] = STAGES.map((stage) => ({
  id: stage.id,
  title: stage.title,
}));

/** Stages that count as a company responding. */
export const RESPONDED_STAGES: ApplicationStage[] = ["screening", "interview", "offer"];
/** Stages still in motion. */
export const ACTIVE_STAGES: ApplicationStage[] = ["applied", "screening", "interview", "offer"];

export const STRONG_MATCH = 80;
export const SOURCE_LABEL: Record<ApplicationSource, string> = {
  direct: "Direct",
  scouted: "Company site",
};

export const SAVED_BOARD_PREFIX = "saved:";

export function savedBoardJobId(id: string) {
  return id.startsWith(SAVED_BOARD_PREFIX) ? id.slice(SAVED_BOARD_PREFIX.length) : null;
}

export function hydrateApplication(raw: Application): Application {
  return {
    ...raw,
    activity: (raw.activity ?? []).map((event) => ({
      ...event,
      date: parseJSONDate(event.date),
    })),
    updated: parseJSONDate(raw.updated),
  };
}

export function applicationStats(items: Application[]) {
  const sent = items.filter((item) => item.columnId !== "saved");
  const responded = sent.filter((item) => RESPONDED_STAGES.includes(item.columnId)).length;
  const percent = (part: number, whole: number) =>
    whole === 0 ? 0 : Math.round((part / whole) * 100);
  return {
    active: items.filter((item) => ACTIVE_STAGES.includes(item.columnId)).length,
    sent: sent.length,
    responseRate: percent(responded, sent.length),
    interviewing: items.filter((item) => item.columnId === "interview").length,
    offers: items.filter((item) => item.columnId === "offer").length,
  };
}
