import type {
  BarDatum,
  DonutSlice,
  FunnelStage,
  HeatmapDay,
  KpiDelta,
} from "@joined/design-system";
import { SOURCES, STAGE_LABEL, stageOf, type Application } from "./applications";
import { WEEKDAYS, addDays, daysBetween, formatDay, weekStart, weekdayOf, type Day } from "./dates";

/** Date ranges the Statistics filter offers, in days. */
export const RANGES = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "6 months" },
] as const;
export type RangeValue = (typeof RANGES)[number]["value"];
export const DEFAULT_RANGE: RangeValue = "90";

/** The trend always shows at least this many weeks, so a short range still has a shape. */
const MIN_TREND_WEEKS = 8;
const DAYS_PER_WEEK = 7;
const PERCENT = 100;
const RECENT_LIMIT = 8;
const UPCOMING_LIMIT = 5;

export type Window = { from: Day; to: Day };

export function windowFor(range: RangeValue, today: Day): Window {
  return { from: addDays(today, 1 - Number(range)), to: today };
}

/** The same length of time just before `window`, for deltas. */
export function previousWindow(window: Window): Window {
  const length = daysBetween(window.from, window.to) + 1;
  return { from: addDays(window.from, -length), to: addDays(window.from, -1) };
}

export function within(day: Day | null, window: Window): day is Day {
  return day !== null && day >= window.from && day <= window.to;
}

export type Summary = {
  applied: number;
  replied: number;
  interviews: number;
  offers: number;
  /** Replies among the applications sent in the window, in percent. */
  responseRate: number;
  /** Median days from applying to the first reply; null with no replies. */
  medianReplyDays: number | null;
};

export function summarize(apps: Application[], window: Window): Summary {
  const cohort = apps.filter((app) => within(app.appliedOn, window));
  const answered = cohort.filter((app) => app.repliedOn);
  const waits = answered.map((app) => daysBetween(app.appliedOn as Day, app.repliedOn as Day));
  return {
    applied: cohort.length,
    replied: apps.filter((app) => within(app.repliedOn, window)).length,
    interviews: apps.filter((app) => within(app.interviewOn, window)).length,
    offers: apps.filter((app) => within(app.offerOn, window)).length,
    responseRate: cohort.length ? Math.round((answered.length / cohort.length) * PERCENT) : 0,
    medianReplyDays: waits.length ? median(waits) : null,
  };
}

/** Change against the previous window. `lowerIsBetter` flips the colour, not the sign. */
export function deltaOf(
  current: number,
  previous: number,
  { unit = "%", lowerIsBetter = false }: { unit?: "%" | "pts" | "d"; lowerIsBetter?: boolean } = {},
): KpiDelta | undefined {
  if (unit === "%" && previous === 0) return undefined;
  const change =
    unit === "%" ? Math.round(((current - previous) / previous) * PERCENT) : current - previous;
  if (change === 0) return { value: unit === "%" ? "0%" : `0 ${unit}`, direction: "flat" };
  const better = lowerIsBetter ? change < 0 : change > 0;
  const sign = change > 0 ? "+" : "−";
  const size = Math.abs(change);
  return {
    value: unit === "%" ? `${sign}${size}%` : `${sign}${size} ${unit}`,
    direction: better ? "up" : "down",
  };
}

export type Weekly = {
  labels: string[];
  applied: number[];
  replies: number[];
  interviews: number[];
  /** Replies over applications per week, in percent. */
  rate: number[];
  /** Median days from applying to the replies that arrived that week; 0 with none. */
  replyDays: number[];
};

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function weekly(apps: Application[], range: RangeValue, today: Day): Weekly {
  const weeks = Math.max(MIN_TREND_WEEKS, Math.ceil(Number(range) / DAYS_PER_WEEK));
  const first = addDays(weekStart(today), -(weeks - 1) * DAYS_PER_WEEK);
  const starts = Array.from({ length: weeks }, (_, index) => addDays(first, index * DAYS_PER_WEEK));
  const bucket = (day: Day | null) => {
    if (!day || day < first || day > today) return -1;
    return Math.floor(daysBetween(first, day) / DAYS_PER_WEEK);
  };
  const count = (pick: (app: Application) => Day | null) => {
    const totals = starts.map(() => 0);
    apps.forEach((app) => {
      const index = bucket(pick(app));
      if (index >= 0) totals[index] += 1;
    });
    return totals;
  };
  const applied = count((app) => app.appliedOn);
  const replies = count((app) => app.repliedOn);
  const waits = starts.map((): number[] => []);
  apps.forEach((app) => {
    const index = bucket(app.repliedOn);
    if (index >= 0 && app.appliedOn && app.repliedOn) {
      waits[index].push(daysBetween(app.appliedOn, app.repliedOn));
    }
  });
  return {
    labels: starts.map(formatDay),
    applied,
    replies,
    interviews: count((app) => app.interviewOn),
    rate: applied.map((total, index) =>
      total ? Math.round((Math.min(replies[index], total) / total) * PERCENT) : 0,
    ),
    replyDays: waits.map(median),
  };
}

const STAGE_ORDER = ["applied", "replied", "interview", "offer", "rejected"] as const;
const STAGE_TONE = {
  applied: "blue",
  replied: "orange",
  interview: "purple",
  offer: "green",
  rejected: "neutral",
} as const satisfies Record<(typeof STAGE_ORDER)[number], DonutSlice["tone"]>;

/** Where each application sent in the window stands now. */
export function stageMix(apps: Application[], window: Window): DonutSlice[] {
  const cohort = apps.filter((app) => within(app.appliedOn, window));
  return STAGE_ORDER.map((stage) => ({
    label: STAGE_LABEL[stage],
    value: cohort.filter((app) => stageOf(app) === stage).length,
    tone: STAGE_TONE[stage],
  }));
}

export function funnel(apps: Application[], window: Window): FunnelStage[] {
  const cohort = apps.filter((app) => within(app.savedOn, window));
  return [
    { label: "Saved", value: cohort.length, hint: "Kept from a job board" },
    {
      label: "Applied",
      value: cohort.filter((app) => app.appliedOn).length,
      hint: "Filled by Acorn",
    },
    {
      label: "Replied",
      value: cohort.filter((app) => app.repliedOn).length,
      hint: "A person wrote back",
    },
    {
      label: "Interview",
      value: cohort.filter((app) => app.interviewOn).length,
      hint: "On the calendar",
    },
    { label: "Offer", value: cohort.filter((app) => app.offerOn).length },
  ];
}

export function bySource(apps: Application[], window: Window): BarDatum[] {
  const cohort = apps.filter((app) => within(app.appliedOn, window));
  return SOURCES.map((source) => ({
    label: source,
    value: cohort.filter((app) => app.source === source).length,
  })).sort((a, b) => b.value - a.value);
}

/** Reply rate per source, for the sources that have enough applications to say anything. */
export function replyRateBySource(apps: Application[], window: Window): BarDatum[] {
  const cohort = apps.filter((app) => within(app.appliedOn, window));
  return SOURCES.map((source) => {
    const sent = cohort.filter((app) => app.source === source);
    const answered = sent.filter((app) => app.repliedOn).length;
    return {
      label: source,
      value: sent.length ? Math.round((answered / sent.length) * PERCENT) : 0,
    };
  }).sort((a, b) => b.value - a.value);
}

export function byWeekday(apps: Application[], window: Window): BarDatum[] {
  const totals = WEEKDAYS.map(() => 0);
  apps.forEach((app) => {
    if (within(app.appliedOn, window)) totals[weekdayOf(app.appliedOn)] += 1;
  });
  const busiest = Math.max(...totals);
  return WEEKDAYS.map((label, index) => ({
    label,
    value: totals[index],
    tone: totals[index] === busiest && busiest > 0 ? "blue" : "neutral",
  }));
}

/** One entry per day in the window, zeros included, so the grid has no holes. */
export function dailyActivity(apps: Application[], window: Window): HeatmapDay[] {
  const counts = new Map<Day, number>();
  apps.forEach((app) => {
    if (within(app.appliedOn, window))
      counts.set(app.appliedOn, (counts.get(app.appliedOn) ?? 0) + 1);
  });
  const length = daysBetween(window.from, window.to) + 1;
  return Array.from({ length }, (_, index) => {
    const date = addDays(window.from, index);
    return { date, value: counts.get(date) ?? 0 };
  });
}

/** Busiest weekday and the longest run of days with at least one application. */
export function habits(days: HeatmapDay[]) {
  let streak = 0;
  let best = 0;
  days.forEach((day) => {
    streak = day.value > 0 ? streak + 1 : 0;
    best = Math.max(best, streak);
  });
  let current = 0;
  for (let index = days.length - 1; index >= 0 && days[index].value > 0; index -= 1) current += 1;
  const active = days.filter((day) => day.value > 0).length;
  return { bestStreak: best, currentStreak: current, activeDays: active, totalDays: days.length };
}

export type Upcoming = { id: string; company: string; role: string; contact: string; on: Day };

export function upcomingInterviews(apps: Application[], today: Day): Upcoming[] {
  return apps
    .filter((app) => app.interviewOn && app.interviewOn >= today && !app.offerOn)
    .map((app) => ({
      id: app.id,
      company: app.company,
      role: app.role,
      contact: app.contact,
      on: app.interviewOn as Day,
    }))
    .sort((a, b) => a.on.localeCompare(b.on))
    .slice(0, UPCOMING_LIMIT);
}

/** The latest thing that happened to an application, for sorting a recent list. */
export function lastEvent(app: Application, today: Day): Day {
  const days = [app.savedOn, app.appliedOn, app.repliedOn, app.interviewOn, app.offerOn].filter(
    (day): day is Day => day !== null && day <= today,
  );
  return days.sort().at(-1) ?? app.savedOn;
}

export function recentApplications(apps: Application[], today: Day, limit = RECENT_LIMIT) {
  return apps
    .filter((app) => app.appliedOn)
    .sort((a, b) => lastEvent(b, today).localeCompare(lastEvent(a, today)))
    .slice(0, limit);
}
