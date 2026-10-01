import type { Profile } from "@/lib/profile";
import { WORKPLACE_LABEL, annualPay } from "./format";
import type { Job } from "./types";

export type MatchProfile = Pick<
  Profile,
  "targetRoles" | "locations" | "salaryFloor" | "skills" | "authorization"
>;

export type MatchLevel = "yes" | "partial" | "no";

export type MatchCriterion = {
  id: "role" | "skills" | "pay" | "location";
  label: string;
  detail: string;
  level: MatchLevel;
};

export type JobMatch = {
  score: number;
  criteria: MatchCriterion[];
  matchedSkills: string[];
  missingSkills: string[];
  /** The candidate needs sponsorship and this job does not offer it. */
  needsVisa: boolean;
};

/** How much each criterion counts toward the score. Sums to 100. */
const WEIGHTS: Record<MatchCriterion["id"], number> = {
  role: 35,
  skills: 35,
  pay: 15,
  location: 15,
};
const PARTIAL_CREDIT = 0.5;
/** Pay within this share of the floor still earns partial credit. */
const PAY_TOLERANCE = 0.85;
const SPONSORSHIP_REQUIRED = "us-sponsor";
const REMOTE_PREFIX = "remote";

export const STRONG_MATCH = 75;
export const GOOD_MATCH = 50;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function headNoun(role: string) {
  return normalize(role).split(/\s+/).at(-1) ?? "";
}

function cityOf(location: string) {
  return normalize(location.split(/[,—(]/)[0] ?? "");
}

function credit(level: MatchLevel) {
  if (level === "yes") return 1;
  return level === "partial" ? PARTIAL_CREDIT : 0;
}

function roleCriterion(job: Job, profile: MatchProfile): MatchCriterion {
  const title = normalize(job.title);
  const exact = profile.targetRoles.find((role) => title.includes(normalize(role)));
  const near = profile.targetRoles.find((role) => title.split(/\s+/).includes(headNoun(role)));
  if (exact)
    return { id: "role", label: "Target role", detail: `Matches “${exact}”`, level: "yes" };
  if (near)
    return { id: "role", label: "Target role", detail: `Close to “${near}”`, level: "partial" };
  return { id: "role", label: "Target role", detail: "Outside your target roles", level: "no" };
}

function skillsCriterion(matched: string[], total: number): MatchCriterion {
  const ratio = total === 0 ? 0 : matched.length / total;
  const level: MatchLevel = ratio >= 1 ? "yes" : ratio > 0 ? "partial" : "no";
  return {
    id: "skills",
    label: "Skills",
    detail: `${matched.length} of ${total} listed skills`,
    level,
  };
}

function payCriterion(job: Job, profile: MatchProfile): MatchCriterion {
  const top = annualPay(job.pay, "max");
  if (top >= profile.salaryFloor)
    return { id: "pay", label: "Pay", detail: "Meets your salary floor", level: "yes" };
  if (top >= profile.salaryFloor * PAY_TOLERANCE)
    return { id: "pay", label: "Pay", detail: "Just under your salary floor", level: "partial" };
  return { id: "pay", label: "Pay", detail: "Below your salary floor", level: "no" };
}

function locationCriterion(job: Job, profile: MatchProfile): MatchCriterion {
  const wantsRemote = profile.locations.some((place) => normalize(place).startsWith(REMOTE_PREFIX));
  const city = cityOf(job.location);
  const inCity = profile.locations.some((place) => cityOf(place) === city);
  if (job.workplace === "remote" && wantsRemote)
    return { id: "location", label: "Location", detail: "Remote, as you prefer", level: "yes" };
  if (inCity)
    return {
      id: "location",
      label: "Location",
      detail: `${WORKPLACE_LABEL[job.workplace]} in a city you chose`,
      level: "yes",
    };
  if (job.workplace === "remote")
    return { id: "location", label: "Location", detail: "Remote", level: "partial" };
  return { id: "location", label: "Location", detail: "Outside your locations", level: "no" };
}

/** Scores a job against the candidate’s profile and explains every point. */
export function matchJob(job: Job, profile: MatchProfile): JobMatch {
  const mine = new Set(profile.skills.map(normalize));
  const matchedSkills = job.skills.filter((skill) => mine.has(normalize(skill)));
  const missingSkills = job.skills.filter((skill) => !mine.has(normalize(skill)));
  const criteria = [
    roleCriterion(job, profile),
    skillsCriterion(matchedSkills, job.skills.length),
    payCriterion(job, profile),
    locationCriterion(job, profile),
  ];
  const skillRatio = job.skills.length === 0 ? 0 : matchedSkills.length / job.skills.length;
  const score = criteria.reduce(
    (sum, item) =>
      sum + WEIGHTS[item.id] * (item.id === "skills" ? skillRatio : credit(item.level)),
    0,
  );
  return {
    score: Math.round(score),
    criteria,
    matchedSkills,
    missingSkills,
    needsVisa: profile.authorization === SPONSORSHIP_REQUIRED && !job.visa,
  };
}
