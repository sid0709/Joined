import { addDays, daysBetween, weekdayOf, type Day } from "./dates";

/**
 * Applications Acorn has submitted and what happened after. acorn-backend stores which
 * jobs were saved and applied but not when, or what came back, so the workspace runs on
 * a seeded sample in this shape until it does.
 */

export const SOURCES = ["LinkedIn", "Greenhouse", "Lever", "Workday", "Company site"] as const;
export type Source = (typeof SOURCES)[number];

export const WORK_MODES = ["Remote", "Hybrid", "On-site"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export type Stage = "saved" | "applied" | "replied" | "interview" | "offer" | "rejected";

export type Application = {
  id: string;
  company: string;
  role: string;
  location: string;
  workMode: WorkMode;
  source: Source;
  /** The recruiter or hiring manager who writes back. */
  contact: string;
  savedOn: Day;
  appliedOn: Day | null;
  repliedOn: Day | null;
  interviewOn: Day | null;
  offerOn: Day | null;
  rejectedOn: Day | null;
};

export const STAGE_LABEL: Record<Stage, string> = {
  saved: "Saved",
  applied: "Waiting",
  replied: "Replied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Closed",
};

/** Badge variants per stage; red is kept for nothing here — a closed role is not an error. */
export const STAGE_BADGE = {
  saved: "neutral",
  applied: "blue",
  replied: "purple",
  interview: "orange",
  offer: "success",
  rejected: "neutral",
} as const satisfies Record<Stage, string>;

/** The furthest point an application reached. */
export function stageOf(app: Application): Stage {
  if (app.offerOn) return "offer";
  if (app.rejectedOn) return "rejected";
  if (app.interviewOn) return "interview";
  if (app.repliedOn) return "replied";
  if (app.appliedOn) return "applied";
  return "saved";
}

// ── Sample ────────────────────────────────────────────────────────────

const SAMPLE_SIZE = 160;
const HISTORY_DAYS = 210;
/** Below 1 leans the sample toward recent days, so activity grows week over week. */
const RECENCY = 0.75;
const APPLY_RATE = 0.84;
const REPLY_RATE = 0.34;
const REJECT_SHARE = 0.42;
const INTERVIEW_SHARE = 0.55;
const OFFER_SHARE = 0.3;
const WEEKEND_SKIP = 0.9;
const SOURCE_WEIGHTS = [0.4, 0.24, 0.16, 0.08, 0.12];
const MODE_WEIGHTS = [0.5, 0.35, 0.15];

const COMPANIES = [
  ["Northwind", "San Francisco, CA"],
  ["Lumen", "New York, NY"],
  ["Harbor Health", "Boston, MA"],
  ["Quill", "Remote · US"],
  ["Fathom Labs", "Seattle, WA"],
  ["Brightline", "Austin, TX"],
  ["Cobalt", "Denver, CO"],
  ["Meridian Pay", "New York, NY"],
  ["Orbit", "San Francisco, CA"],
  ["Pinecone Health", "Chicago, IL"],
  ["Tidewater", "Remote · US"],
  ["Verdant", "Portland, OR"],
  ["Atlas Freight", "Atlanta, GA"],
  ["Sable", "Los Angeles, CA"],
  ["Kestrel", "Remote · US"],
  ["Granite Cloud", "Seattle, WA"],
] as const;

const ROLES = [
  "Senior Software Engineer",
  "Staff Software Engineer",
  "Software Engineer, Platform",
  "Senior Frontend Engineer",
  "Full Stack Engineer",
  "Engineering Manager",
  "Senior Backend Engineer",
];

const CONTACTS = [
  "Avery Chen",
  "Jordan Patel",
  "Sam Rivera",
  "Riley Brooks",
  "Morgan Ellis",
  "Casey Nguyen",
  "Taylor Kim",
  "Drew Okafor",
  "Jamie Lopez",
  "Alex Moreau",
];

/** A small seeded generator, so a given day always produces the same sample. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pick<T>(random: () => number, items: readonly T[], weights?: number[]): T {
  if (!weights) return items[Math.floor(random() * items.length)];
  let roll = random();
  for (let index = 0; index < items.length; index += 1) {
    roll -= weights[index] ?? 0;
    if (roll <= 0) return items[index];
  }
  return items[items.length - 1];
}

function between(random: () => number, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1));
}

/** Moves most weekend days to the nearest weekday — people apply on workdays. */
function workday(random: () => number, day: Day): Day {
  const weekday = weekdayOf(day);
  if ((weekday === 0 || weekday === 6) && random() < WEEKEND_SKIP) {
    return addDays(day, weekday === 0 ? 1 : -1);
  }
  return day;
}

function atMost(day: Day, today: Day): Day | null {
  return daysBetween(day, today) >= 0 ? day : null;
}

function noLaterThan(day: Day, today: Day): Day {
  return daysBetween(day, today) >= 0 ? day : today;
}

export function sampleApplications(today: Day): Application[] {
  const random = seeded(Number(today.replaceAll("-", "")));
  const apps: Application[] = Array.from({ length: SAMPLE_SIZE }, (_, index) => {
    const [company, location] = pick(random, COMPANIES);
    const daysAgo = Math.floor(HISTORY_DAYS * (1 - random() ** RECENCY));
    const savedOn = noLaterThan(workday(random, addDays(today, -daysAgo)), today);
    const appliedOn =
      random() < APPLY_RATE && daysAgo > 0
        ? atMost(workday(random, addDays(savedOn, between(random, 0, 2))), today)
        : null;
    const repliedOn =
      appliedOn && random() < REPLY_RATE
        ? atMost(workday(random, addDays(appliedOn, between(random, 2, 12))), today)
        : null;
    const rejected = repliedOn !== null && random() < REJECT_SHARE;
    // An interview can be on the calendar ahead of today.
    const interviewOn =
      repliedOn && !rejected && random() < INTERVIEW_SHARE
        ? workday(random, addDays(repliedOn, between(random, 3, 10)))
        : null;
    const offerOn =
      interviewOn && random() < OFFER_SHARE
        ? atMost(addDays(interviewOn, between(random, 5, 12)), today)
        : null;
    return {
      id: `app-${index}`,
      company,
      role: pick(random, ROLES),
      location,
      workMode: location.startsWith("Remote") ? "Remote" : pick(random, WORK_MODES, MODE_WEIGHTS),
      source: pick(random, SOURCES, SOURCE_WEIGHTS),
      contact: pick(random, CONTACTS),
      savedOn,
      appliedOn,
      repliedOn,
      interviewOn,
      offerOn,
      rejectedOn: rejected ? repliedOn : null,
    };
  });
  return apps;
}
