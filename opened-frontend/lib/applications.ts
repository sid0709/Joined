import type { BadgeVariant, KanbanColumn } from "@openseat/design-system";
import { daysFromToday } from "@/lib/dates";

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

export const APPLICATIONS: Application[] = [
  {
    id: "app-1",
    columnId: "interview",
    jobId: "product-designer-northwind",
    title: "Product Designer",
    company: "Northwind",
    location: "Chicago · Hybrid",
    salary: "$135k – $160k",
    source: "direct",
    resume: "General",
    match: 91,
    updated: daysFromToday(0),
    nextStep: "Round 1 video interview",
    activity: [
      { id: "a1-4", label: "Interview scheduled", date: daysFromToday(0) },
      { id: "a1-3", label: "Recruiter screen passed", date: daysFromToday(-3) },
      { id: "a1-2", label: "Application viewed", date: daysFromToday(-6) },
      { id: "a1-1", label: "Applied with General resume", date: daysFromToday(-8) },
    ],
  },
  {
    id: "app-2",
    columnId: "screening",
    jobId: "frontend-engineer-harbor",
    title: "Frontend Engineer",
    company: "Harbor",
    location: "Remote",
    salary: "$150k – $175k",
    source: "direct",
    resume: "General",
    match: 84,
    updated: daysFromToday(-1),
    nextStep: "Confirm interview invite",
    activity: [
      { id: "a2-3", label: "Invite detected in email", date: daysFromToday(-1) },
      { id: "a2-2", label: "Application viewed", date: daysFromToday(-4) },
      { id: "a2-1", label: "Applied with General resume", date: daysFromToday(-7) },
    ],
  },
  {
    id: "app-3",
    columnId: "applied",
    jobId: "data-analyst-northwind",
    title: "Data Analyst",
    company: "Northwind",
    location: "New York · Hybrid",
    salary: "$110k – $130k",
    source: "direct",
    resume: "General",
    match: 72,
    updated: daysFromToday(-5),
    activity: [{ id: "a3-1", label: "Applied with General resume", date: daysFromToday(-5) }],
  },
  {
    id: "app-4",
    columnId: "saved",
    jobId: "support-lead-harbor",
    title: "Support Lead",
    company: "Harbor",
    location: "Remote",
    salary: "$95k – $115k",
    source: "direct",
    resume: "General",
    match: 68,
    updated: daysFromToday(-6),
    nextStep: "Apply before the posting closes",
    activity: [{ id: "a4-1", label: "Saved", date: daysFromToday(-6) }],
  },
  {
    id: "app-5",
    columnId: "saved",
    jobId: "brand-designer-fieldnote",
    title: "Brand Designer",
    company: "Fieldnote",
    location: "Austin · On-site",
    salary: "$105k – $125k",
    source: "scouted",
    resume: "Design-focused",
    match: 77,
    updated: daysFromToday(-2),
    activity: [{ id: "a5-1", label: "Saved", date: daysFromToday(-2) }],
  },
  {
    id: "app-6",
    columnId: "offer",
    jobId: "engineering-manager-lumen",
    title: "Engineering Manager",
    company: "Lumen Health",
    location: "Chicago · Hybrid",
    salary: "$165k – $185k",
    source: "direct",
    resume: "Design-focused",
    match: 88,
    updated: daysFromToday(-1),
    nextStep: "Reply to the offer by Friday",
    activity: [
      { id: "a6-4", label: "Offer received", date: daysFromToday(-1) },
      { id: "a6-3", label: "Final round completed", date: daysFromToday(-9) },
      { id: "a6-2", label: "Round 1 completed", date: daysFromToday(-16) },
      { id: "a6-1", label: "Applied with Design-focused resume", date: daysFromToday(-24) },
    ],
  },
  {
    id: "app-7",
    columnId: "closed",
    jobId: "recruiter-lumen",
    title: "Technical Recruiter",
    company: "Lumen Health",
    location: "Remote",
    salary: "$90k – $110k",
    source: "scouted",
    resume: "General",
    match: 61,
    updated: daysFromToday(-14),
    closedReason: "No response",
    activity: [{ id: "a7-1", label: "Marked applied on company site", date: daysFromToday(-30) }],
  },
  {
    id: "app-8",
    columnId: "closed",
    jobId: "content-designer-fieldnote",
    title: "Content Designer",
    company: "Fieldnote",
    location: "Remote",
    salary: "$115k – $135k",
    source: "direct",
    resume: "Design-focused",
    match: 79,
    updated: daysFromToday(-22),
    closedReason: "Rejected",
    activity: [
      { id: "a8-3", label: "Rejected after round 2", date: daysFromToday(-22) },
      { id: "a8-2", label: "Round 2 completed", date: daysFromToday(-24) },
      { id: "a8-1", label: "Applied with Design-focused resume", date: daysFromToday(-35) },
    ],
  },
];

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
