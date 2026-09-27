import { PROFILE } from "@/lib/profile";
import { JOBS } from "./data";
import { matchJob, type JobMatch } from "./match";
import type { Job } from "./types";

/** Every job scored once against the signed-in profile. */
const MATCHES: Map<string, JobMatch> = new Map(JOBS.map((job) => [job.id, matchJob(job, PROFILE)]));

/** The signed-in hunter’s match for a job. */
export function matchFor(job: Job) {
  return MATCHES.get(job.id) ?? matchJob(job, PROFILE);
}

export function scoreFor(job: Job) {
  return matchFor(job).score;
}
