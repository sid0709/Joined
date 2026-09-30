import type {
  Assessment,
  BidderLevel,
  BidderProfile,
  BoardTask,
} from "@/src/candidate/types/workspace";

import { PLATFORM_FEE } from "@/src/candidate/lib/derive";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";

const LEVEL_ORDER: (BidderLevel | "New")[] = ["New", "Rising", "Top", "Elite"];
const round = (value: number) => Math.round(value * 100) / 100;

export const slotsLeft = (task: BoardTask) => Math.max(0, task.slots - task.slotsFilled);
export const bestRate = (task: BoardTask) =>
  Math.max(...task.packageLines.map((line) => line.rate));

/** What a bidder would earn after the platform fee: per week for permanent desks, per batch for one-time. */
export function taskPotential(task: BoardTask) {
  const gross = task.packageLines.reduce((sum, line) => sum + line.quota * line.rate, 0);
  return {
    amount: round(gross * (1 - PLATFORM_FEE)),
    unit: task.type === "permanent" ? "per week" : "per batch",
    links: task.packageLines.reduce((sum, line) => sum + line.quota, 0),
  };
}

export interface FitCheck {
  id: string;
  label: string;
  ok: boolean;
  hint?: string;
}

export function fitChecks(
  task: BoardTask,
  profile: BidderProfile,
  assessments: Assessment[],
): FitCheck[] {
  const checks: FitCheck[] = [];
  const atsNeeded = task.packageLines.flatMap(
    (line) => PACKAGE_BY_ID.get(line.packageId)?.ats ?? [],
  );
  checks.push({
    id: "ats",
    label: `Experience with ${[...new Set(atsNeeded)].join(" and ")}`,
    ok: atsNeeded.some((ats) => profile.specialties.includes(ats)),
    hint: "Add the system to your specialties in your profile.",
  });
  if (task.minLevel) {
    checks.push({
      id: "level",
      label: `${task.minLevel} level or above`,
      ok: LEVEL_ORDER.indexOf(profile.level) >= LEVEL_ORDER.indexOf(task.minLevel),
      hint: `You are ${profile.level}. Levels rise with QA rate and delivered links.`,
    });
  }
  if (task.requiredAssessmentId) {
    const assessment = assessments.find((item) => item.id === task.requiredAssessmentId);
    checks.push({
      id: "assessment",
      label: `${assessment?.title ?? "Required"} assessment passed`,
      ok: assessment?.status === "passed",
      hint: "Pass this assessment before the hunter can connect you.",
    });
  }
  const weekly =
    task.type === "permanent" ? task.packageLines.reduce((sum, line) => sum + line.quota, 0) : 0;
  checks.push({
    id: "capacity",
    label: weekly
      ? `Capacity for about ${weekly} links a week`
      : `Capacity for ${task.dailyTarget} links a day`,
    ok: weekly ? profile.weeklyCapacity >= weekly : true,
    hint: "Update your weekly capacity in your profile.",
  });
  checks.push({
    id: "rate",
    label: "Listed rates meet your minimum",
    ok: task.packageLines.every((line) => {
      const ats = PACKAGE_BY_ID.get(line.packageId)?.ats[0];
      const min = ats ? profile.minRates[ats] : undefined;
      return min === undefined || line.rate >= min;
    }),
    hint: "One package is below your minimum. You can propose a higher rate when you contact the hunter.",
  });
  return checks;
}

export const suggestedPitch = (task: BoardTask, hunterFirstName: string, profile: BidderProfile) =>
  `Hi ${hunterFirstName}, I saw "${task.title}" on the board. I work mostly with ${profile.specialties.slice(0, 3).join(", ")}, verify every link and screenshot each confirmation page. I can commit to about ${task.dailyTarget} links a day and start ${task.type === "permanent" ? "this week" : "right away"}. Happy to jump on a short call.`;
