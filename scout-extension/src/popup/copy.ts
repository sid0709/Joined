import type { CapturedJob, JobBoard } from "../capture";

export const COPY = {
  DETECTED_JOB: "Detected job",
  NO_JOB_FOUND: "No job found on this page",
  LOOKING_FOR_JOB: "Looking for a job…",
} as const;

export const DESCRIPTION_PREVIEW_CHARS = 280;
export const META_SEPARATOR = " · ";

export function jobBoardLabel(board: JobBoard): string {
  switch (board) {
    case "greenhouse":
      return "Greenhouse";
    case "lever":
      return "Lever";
    case "ashby":
      return "Ashby";
    case "workday":
      return "Workday";
    case "linkedin":
      return "LinkedIn";
    case "unknown":
      return "Job page";
    default: {
      const _exhaustive: never = board;
      return _exhaustive;
    }
  }
}

export function jobMetaLine(job: Pick<CapturedJob, "company" | "location">): string {
  return [job.company, job.location].filter(Boolean).join(META_SEPARATOR);
}

export function previewText(value: string, maxLength = DESCRIPTION_PREVIEW_CHARS): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trimEnd()}…`;
}
