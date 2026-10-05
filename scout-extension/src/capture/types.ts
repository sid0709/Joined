export const JOB_BOARDS = [
  "greenhouse",
  "lever",
  "ashby",
  "workday",
  "linkedin",
  "smartrecruiters",
  "icims",
  "workable",
  "bamboohr",
  "jobvite",
  "recruitee",
  "unknown",
] as const;

export type JobBoard = (typeof JOB_BOARDS)[number];

export type KnownJobBoard = Exclude<JobBoard, "unknown">;

export interface ExtractedFields {
  title?: string;
  company?: string;
  location?: string;
  applyUrl?: string;
  description?: string;
}

export interface CapturedJob {
  board: JobBoard;
  title: string;
  company: string;
  location: string;
  applyUrl: string;
  description: string;
}

export function isJobBoard(value: unknown): value is JobBoard {
  return typeof value === "string" && (JOB_BOARDS as readonly string[]).includes(value);
}
