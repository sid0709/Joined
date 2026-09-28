import { emptyProfile } from "@/lib/profile";
import { matchJob, type MatchProfile } from "./match";
import type { Job } from "./types";

const EMPTY_PROFILE: MatchProfile = {
  targetRoles: emptyProfile().targetRoles,
  locations: emptyProfile().locations,
  salaryFloor: emptyProfile().salaryFloor,
  skills: emptyProfile().skills,
  authorization: emptyProfile().authorization,
};

/** The hunter’s match for a job, using the signed-in profile when one is passed. */
export function matchFor(job: Job, profile: MatchProfile = EMPTY_PROFILE) {
  return matchJob(job, profile);
}

export function scoreFor(job: Job, profile: MatchProfile = EMPTY_PROFILE) {
  return matchFor(job, profile).score;
}
