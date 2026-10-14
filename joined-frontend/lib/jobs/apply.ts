import type { Job } from "./types";

/** The listing's own apply URL, or null when it has none. */
export function jobApplyLink(job: Pick<Job, "applyLink">) {
  const link = job.applyLink?.trim();
  return link ? link : null;
}

/** Whether Apply can do anything: an external link, or Joined's own application form. */
export function canApplyToJob(job: Pick<Job, "applyLink" | "source">) {
  return jobApplyLink(job) !== null || job.source === "direct";
}
