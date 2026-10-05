import type { BadgeVariant, KanbanColumn } from "sid-ui";
import { reminderStatus } from "@/lib/application-reminders";
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
  /** Private tracker notes. Omitted when the API does not return them. */
  notes?: string;
  /** When to follow up. Omitted when the API does not return a reminder. */
  remindAt?: Date | null;
};

export type ApplicationPayload = Omit<
  Application,
  "updated" | "activity" | "notes" | "remindAt"
> & {
  updated: string | Date;
  activity?: { id: string; label: string; date: string | Date }[];
  notes?: string | null;
  remindAt?: string | Date | null;
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

/** Stages on the apply → offer stepper. Saved and Closed sit outside it. */
export const PIPELINE_STAGES: ApplicationStage[] = ["applied", "screening", "interview", "offer"];

/** Stages a manually tracked application can start in. Saved jobs come from Save. */
export const ADD_STAGES: ApplicationStage[] = PIPELINE_STAGES;

/** Stages that count as a company responding. */
export const RESPONDED_STAGES: ApplicationStage[] = ["screening", "interview", "offer"];
/** Stages still in motion. */
export const ACTIVE_STAGES: ApplicationStage[] = ["applied", "screening", "interview", "offer"];

export const STRONG_MATCH = 80;
export const MAX_APPLICATION_NOTES = 2000;
export const SOURCE_LABEL: Record<ApplicationSource, string> = {
  direct: "Direct",
  scouted: "Company site",
};

export const SAVED_BOARD_PREFIX = "saved:";

export function savedBoardJobId(id: string) {
  return id.startsWith(SAVED_BOARD_PREFIX) ? id.slice(SAVED_BOARD_PREFIX.length) : null;
}

export function isSavedBoardItem(application: Pick<Application, "id" | "columnId">) {
  return Boolean(savedBoardJobId(application.id)) || application.columnId === "saved";
}

export function canMoveToStage(
  application: Pick<Application, "id" | "columnId">,
  to: ApplicationStage,
) {
  if (to === "saved") return isSavedBoardItem(application);
  return true;
}

export function stageOptions(stages: readonly ApplicationStage[]) {
  return stages.map((id) => ({ value: id, label: STAGE_BY_ID[id].title }));
}

export function stageSelectorOptions(application: Pick<Application, "id" | "columnId">) {
  const ids = STAGES.map((stage) => stage.id).filter(
    (id) => id !== "saved" || isSavedBoardItem(application),
  );
  return stageOptions(ids);
}

export function clipNotes(value: string) {
  return value.slice(0, MAX_APPLICATION_NOTES);
}

export function parseOptionalJSONDate(
  value: string | Date | null | undefined,
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function hydrateApplication(raw: Application | ApplicationPayload): Application {
  const notes = raw.notes == null ? undefined : clipNotes(String(raw.notes));
  return {
    ...raw,
    notes,
    remindAt: parseOptionalJSONDate(raw.remindAt),
    activity: (raw.activity ?? []).map((event) => ({
      ...event,
      date: parseJSONDate(event.date),
    })),
    updated: parseJSONDate(raw.updated),
  };
}

export function applicationStats(items: Application[], now = new Date()) {
  const sent = items.filter((item) => item.columnId !== "saved");
  const responded = sent.filter((item) => RESPONDED_STAGES.includes(item.columnId)).length;
  const percent = (part: number, whole: number) =>
    whole === 0 ? 0 : Math.round((part / whole) * 100);
  return {
    saved: items.filter((item) => item.columnId === "saved").length,
    active: items.filter((item) => ACTIVE_STAGES.includes(item.columnId)).length,
    sent: sent.length,
    responseRate: percent(responded, sent.length),
    interviewing: items.filter((item) => item.columnId === "interview").length,
    offers: items.filter((item) => item.columnId === "offer").length,
    overdueReminders: items.filter((item) => reminderStatus(item.remindAt, now) === "overdue")
      .length,
    upcomingReminders: items.filter((item) => reminderStatus(item.remindAt, now) === "upcoming")
      .length,
  };
}
