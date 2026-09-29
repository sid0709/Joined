/**
 * Layer G — Company funnel analytics (scaffold) shapes.
 *
 * v1 UI aggregates overview / applicants / interviews / jobs client-side via
 * aggregateCompanyAnalytics(). Einstein SHOULD later expose server metrics so
 * we stop shipping every row to the browser.
 *
 * Einstein contract (persist + return these fields; UI scaffolds against them):
 *
 * GET /v1/company/analytics?jobId=&from=&to=
 *   response: CompanyAnalyticsSnapshot
 *   Filters:
 *     jobId?: string          // omit / "" = all jobs the actor can see
 *     from?: string           // YYYY-MM-DD inclusive (company timezone)
 *     to?: string             // YYYY-MM-DD inclusive
 *   Soft RBAC: require analytics.view (owner/admin/recruiter/HM/finance).
 *   Einstein MUST enforce server-side; frontend gate is UX only.
 *
 * Suggested server aggregates (TODO when warehouse is cheap):
 *   funnel.stages[]           // views → applied → … → hired with count + rate
 *   sourceMix.buckets[]       // direct / assisted (bidder|agent) / referral
 *   timeInStage.stages[]      // median + p90 days sitting in each stage
 *   attendance.held / attended / rate
 *   viewsToApplicants.views / applicants / rate
 *
 * Applicant fields Einstein should add for accurate time-in-stage:
 *   Applicant.stageEnteredAt?: string   // ISO when columnId last changed
 *   Applicant.stageHistory?: { stage: string; enteredAt: string }[]
 * Without those, v1 approximates "days in current stage" from appliedOn.
 *
 * Job fields already used:
 *   CompanyJob.views
 * Applicant fields already used:
 *   assisted, referralSource?, appliedOn, columnId, jobId
 * Interview fields already used:
 *   status (attended | no-show | …), date, jobId
 *
 * Out of scope: SSO, Integrations, admin warehouse BI, inventing heavy ETL,
 * Scoutwell. RBAC: lib/rbac.ts (analytics.view).
 */

import type { Applicant, ApplicantStage, AssistedBy } from "@/lib/company/applicants";
import { APPLICANT_STAGES, ASSISTED_LABEL } from "@/lib/company/applicants";
import type { CompanyInterview } from "@/lib/company/interviews";
import type { CompanyJob } from "@/lib/company/jobs";
import { daysBetween, formatISODate, startOfDay } from "@/lib/dates";

const PERCENT = 100;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Funnel step ids used in the UI and in the Einstein snapshot. */
export const FUNNEL_STAGE_IDS = [
  "views",
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
] as const;

export type FunnelStageId = (typeof FUNNEL_STAGE_IDS)[number];

export type FunnelStageMetric = {
  id: FunnelStageId;
  label: string;
  count: number;
  /** Conversion from the previous non-zero stage; null for the first step. */
  conversionFromPrev: number | null;
};

export type SourceBucketId = "direct" | "bidder" | "agent" | "referral" | "other";

export type SourceBucket = {
  id: SourceBucketId;
  label: string;
  count: number;
  share: number;
};

export type TimeInStageMetric = {
  stage: ApplicantStage;
  label: string;
  /** Applicants currently sitting in this stage. */
  count: number;
  /** Average days in stage (v1 proxy or Einstein median). */
  avgDays: number | null;
  /** Median days when Einstein provides stageEnteredAt; else same as avgDays. */
  medianDays: number | null;
  /** True when avg/median are proxies from appliedOn, not stageEnteredAt. */
  isProxy: boolean;
};

export type AttendanceMetric = {
  held: number;
  attended: number;
  noShow: number;
  rate: number | null;
};

export type ViewsToApplicantsMetric = {
  views: number;
  applicants: number;
  rate: number | null;
};

/** Server / client snapshot shape — keep stable for Einstein. */
export type CompanyAnalyticsSnapshot = {
  filters: AnalyticsFilters;
  generatedAt: string;
  /** How the numbers were produced. */
  source: "client_v1" | "einstein";
  funnel: { stages: FunnelStageMetric[] };
  sourceMix: { buckets: SourceBucket[]; assistedShare: number | null };
  timeInStage: { stages: TimeInStageMetric[] };
  attendance: AttendanceMetric;
  viewsToApplicants: ViewsToApplicantsMetric;
};

export type AnalyticsDatePreset = "7d" | "30d" | "90d" | "all";

export type AnalyticsFilters = {
  jobId: string | null;
  from: string | null;
  to: string | null;
  preset: AnalyticsDatePreset;
};

export const ANALYTICS_DATE_PRESETS: {
  value: AnalyticsDatePreset;
  label: string;
  days: number | null;
}[] = [
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
  { value: "all", label: "All time", days: null },
];

export type AnalyticsInput = {
  jobs: CompanyJob[];
  applicants: Applicant[];
  interviews: CompanyInterview[];
  filters: AnalyticsFilters;
  now?: Date;
};

const FUNNEL_LABEL: Record<FunnelStageId, string> = {
  views: "Views",
  applied: "Applied",
  screening: "Screening+",
  interview: "Interview+",
  offer: "Offer+",
  hired: "Hired",
};

/** Stages that count as "reached screening or beyond" for conversion. */
const REACHED_SCREENING: readonly ApplicantStage[] = ["screening", "interview", "offer", "hired"];
const REACHED_INTERVIEW: readonly ApplicantStage[] = ["interview", "offer", "hired"];
const REACHED_OFFER: readonly ApplicantStage[] = ["offer", "hired"];

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * PERCENT);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return sorted[mid]!;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** Resolve preset → inclusive from/to ISO dates (local). */
export function resolveAnalyticsRange(
  preset: AnalyticsDatePreset,
  now = new Date(),
): Pick<AnalyticsFilters, "from" | "to"> {
  const meta = ANALYTICS_DATE_PRESETS.find((item) => item.value === preset);
  if (!meta || meta.days == null) return { from: null, to: null };
  const end = startOfDay(now);
  const start = new Date(end.getTime() - (meta.days - 1) * MS_PER_DAY);
  return { from: formatISODate(start), to: formatISODate(end) };
}

export function defaultAnalyticsFilters(): AnalyticsFilters {
  const preset: AnalyticsDatePreset = "30d";
  const range = resolveAnalyticsRange(preset);
  return { jobId: null, preset, from: range.from, to: range.to };
}

function inDateRange(date: Date, from: string | null, to: string | null): boolean {
  if (!from && !to) return true;
  const day = startOfDay(date).getTime();
  if (from) {
    const [y, m, d] = from.split("-").map(Number);
    if (y && m && d) {
      const start = new Date(y, m - 1, d).getTime();
      if (day < start) return false;
    }
  }
  if (to) {
    const [y, m, d] = to.split("-").map(Number);
    if (y && m && d) {
      const end = new Date(y, m - 1, d).getTime();
      if (day > end) return false;
    }
  }
  return true;
}

function matchesJob<T extends { jobId: string }>(row: T, jobId: string | null): boolean {
  return !jobId || row.jobId === jobId;
}

function sourceBucketFor(person: Applicant): SourceBucketId {
  if (person.referralSource && person.referralSource.trim()) return "referral";
  if (person.assisted === "direct") return "direct";
  if (person.assisted === "bidder") return "bidder";
  if (person.assisted === "agent") return "agent";
  return "other";
}

const SOURCE_LABEL: Record<SourceBucketId, string> = {
  direct: ASSISTED_LABEL.direct,
  bidder: ASSISTED_LABEL.bidder,
  agent: ASSISTED_LABEL.agent,
  referral: "Referral",
  other: "Other",
};

/**
 * Client-side v1 aggregate from overview/applicants/interviews payloads.
 * Replace call sites with GET /company/analytics when Einstein ships it.
 */
export function aggregateCompanyAnalytics(input: AnalyticsInput): CompanyAnalyticsSnapshot {
  const now = input.now ?? new Date();
  const { jobId, from, to } = input.filters;

  const jobs = input.jobs.filter((job) => !jobId || job.id === jobId);
  const applicants = input.applicants.filter(
    (person) => matchesJob(person, jobId) && inDateRange(person.appliedOn, from, to),
  );
  const interviews = input.interviews.filter(
    (item) => matchesJob(item, jobId) && inDateRange(item.date, from, to),
  );

  const views = jobs.reduce((sum, job) => sum + (job.views || 0), 0);
  const applied = applicants.length;
  const screening = applicants.filter((person) =>
    REACHED_SCREENING.includes(person.columnId),
  ).length;
  const interviewReached = applicants.filter((person) =>
    REACHED_INTERVIEW.includes(person.columnId),
  ).length;
  const offerReached = applicants.filter((person) =>
    REACHED_OFFER.includes(person.columnId),
  ).length;
  const hired = applicants.filter((person) => person.columnId === "hired").length;

  const rawCounts: Record<FunnelStageId, number> = {
    views,
    applied,
    screening,
    interview: interviewReached,
    offer: offerReached,
    hired,
  };

  const funnelStages: FunnelStageMetric[] = FUNNEL_STAGE_IDS.map((id, index) => {
    const prevId = index > 0 ? FUNNEL_STAGE_IDS[index - 1] : null;
    const prevCount = prevId ? rawCounts[prevId] : null;
    return {
      id,
      label: FUNNEL_LABEL[id],
      count: rawCounts[id],
      conversionFromPrev: prevCount == null ? null : rate(rawCounts[id], prevCount),
    };
  });

  const sourceCounts: Record<SourceBucketId, number> = {
    direct: 0,
    bidder: 0,
    agent: 0,
    referral: 0,
    other: 0,
  };
  for (const person of applicants) {
    sourceCounts[sourceBucketFor(person)] += 1;
  }
  const sourceTotal = applicants.length;
  const sourceBuckets: SourceBucket[] = (Object.keys(sourceCounts) as SourceBucketId[])
    .filter((id) => sourceCounts[id] > 0 || id === "direct" || id === "bidder" || id === "agent")
    .map((id) => ({
      id,
      label: SOURCE_LABEL[id],
      count: sourceCounts[id],
      share: sourceTotal === 0 ? 0 : Math.round((sourceCounts[id] / sourceTotal) * PERCENT),
    }));
  const assistedCount = sourceCounts.bidder + sourceCounts.agent;
  const assistedShare = rate(assistedCount, sourceTotal);

  // Time-in-stage: v1 proxy = days since appliedOn for people currently in stage.
  // TODO(einstein): prefer stageEnteredAt / stageHistory when present.
  const timeInStage: TimeInStageMetric[] = APPLICANT_STAGES.filter(
    (stage) => stage.id !== "rejected",
  ).map((stage) => {
    const sitting = applicants.filter((person) => person.columnId === stage.id);
    const days = sitting.map((person) => Math.max(0, daysBetween(person.appliedOn, now)));
    return {
      stage: stage.id,
      label: stage.title,
      count: sitting.length,
      avgDays: average(days),
      medianDays: median(days),
      isProxy: true,
    };
  });

  const held = interviews.filter((item) => item.status === "attended" || item.status === "no-show");
  const attended = held.filter((item) => item.status === "attended").length;
  const noShow = held.filter((item) => item.status === "no-show").length;

  return {
    filters: input.filters,
    generatedAt: now.toISOString(),
    source: "client_v1",
    funnel: { stages: funnelStages },
    sourceMix: { buckets: sourceBuckets, assistedShare },
    timeInStage: { stages: timeInStage },
    attendance: {
      held: held.length,
      attended,
      noShow,
      rate: rate(attended, held.length),
    },
    viewsToApplicants: {
      views,
      applicants: applied,
      rate: rate(applied, views),
    },
  };
}

/** Format a conversion / share for display. */
export function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${value}%`;
}

/** Assisted vs direct label for mix summary. */
export function assistedMixHint(assistedShare: number | null): string {
  if (assistedShare == null) return "No applicants in range";
  return `${assistedShare}% assisted · ${PERCENT - assistedShare}% direct / referral`;
}

/** Type guard helper for AssistedBy when hydrating future Einstein payloads. */
export function isAssistedBy(value: string): value is AssistedBy {
  return value === "direct" || value === "bidder" || value === "agent";
}
