import { EMPLOYMENTS, SENIORITIES, WORKPLACES } from "@openseat/job-schema";

import { WORKPLACE_LABEL, annualPay } from "./format";
import type { Employment, Job, JobSource, Seniority, Workplace } from "./types";

export { EMPLOYMENTS, SENIORITIES, WORKPLACES };
export const SOURCES: JobSource[] = ["direct", "aggregated", "scouted"];

export const POSTED_WITHIN = [
  { value: "any", label: "Any time", hours: Number.POSITIVE_INFINITY },
  { value: "24h", label: "Past 24 hours", hours: 24 },
  { value: "3d", label: "Past 3 days", hours: 72 },
  { value: "7d", label: "Past week", hours: 168 },
  { value: "14d", label: "Past 2 weeks", hours: 336 },
] as const;
export type PostedWithin = (typeof POSTED_WITHIN)[number]["value"];

export const SORTS = [
  { value: "relevance", label: "Best match" },
  { value: "newest", label: "Newest" },
  { value: "pay", label: "Highest pay" },
  { value: "applicants", label: "Fewest applicants" },
] as const;
export type SortKey = (typeof SORTS)[number]["value"];

export const LISTS = [
  { value: "all", label: "All jobs" },
  { value: "recommended", label: "For you" },
  { value: "saved", label: "Saved" },
] as const;
export type ListKey = (typeof LISTS)[number]["value"];

/** Minimum yearly pay steps for the pay filter. */
export const PAY_FLOOR_MAX = 200_000;
export const PAY_FLOOR_STEP = 10_000;

export type JobFilters = {
  q: string;
  where: string;
  workplace: Workplace[];
  seniority: Seniority[];
  employment: Employment[];
  source: JobSource[];
  minPay: number;
  posted: PostedWithin;
  visa: boolean;
  sort: SortKey;
  list: ListKey;
};

export const DEFAULT_FILTERS: JobFilters = {
  q: "",
  where: "",
  workplace: [],
  seniority: [],
  employment: [],
  source: [],
  minPay: 0,
  posted: "any",
  visa: false,
  sort: "relevance",
  list: "all",
};

/** The filters that narrow results — search text, sort, and list tab are not counted. */
export type RefinementKey =
  "workplace" | "seniority" | "employment" | "source" | "minPay" | "posted" | "visa";

export const REFINEMENT_KEYS: RefinementKey[] = [
  "workplace",
  "seniority",
  "employment",
  "source",
  "minPay",
  "posted",
  "visa",
];

export function countRefinements(filters: JobFilters) {
  return REFINEMENT_KEYS.reduce((count, key) => {
    const value = filters[key];
    if (Array.isArray(value)) return count + value.length;
    return value === DEFAULT_FILTERS[key] ? count : count + 1;
  }, 0);
}

export function clearRefinements(filters: JobFilters): JobFilters {
  const cleared = { ...filters };
  for (const key of REFINEMENT_KEYS) Object.assign(cleared, { [key]: DEFAULT_FILTERS[key] });
  return cleared;
}

// ── URL ────────────────────────────────────────────────────────────────

type RawParams = Record<string, string | string[] | undefined>;
const LIST_SEPARATOR = ",";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(allowed: readonly T[], value: string | undefined, fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function manyOf<T extends string>(allowed: readonly T[], value: string | undefined): T[] {
  if (!value) return [];
  const picked = value.split(LIST_SEPARATOR);
  return allowed.filter((option) => picked.includes(option));
}

/** Reads filters from the page’s search params, ignoring anything unknown. */
export function parseFilters(params: RawParams): JobFilters {
  const minPay = Number(first(params.pay));
  return {
    q: first(params.q) ?? DEFAULT_FILTERS.q,
    where: first(params.where) ?? DEFAULT_FILTERS.where,
    workplace: manyOf(WORKPLACES, first(params.workplace)),
    seniority: manyOf(SENIORITIES, first(params.level)),
    employment: manyOf(EMPLOYMENTS, first(params.type)),
    source: manyOf(SOURCES, first(params.source)),
    minPay: Number.isFinite(minPay) && minPay > 0 ? Math.min(minPay, PAY_FLOOR_MAX) : 0,
    posted: oneOf(
      POSTED_WITHIN.map((option) => option.value),
      first(params.posted),
      DEFAULT_FILTERS.posted,
    ),
    visa: first(params.visa) === "1",
    sort: oneOf(
      SORTS.map((option) => option.value),
      first(params.sort),
      DEFAULT_FILTERS.sort,
    ),
    list: oneOf(
      LISTS.map((option) => option.value),
      first(params.list),
      DEFAULT_FILTERS.list,
    ),
  };
}

/** Writes only the filters that differ from the defaults, so shared links stay short. */
export function serializeFilters(filters: JobFilters) {
  const params = new URLSearchParams();
  const set = (key: string, value: string) => {
    if (value) params.set(key, value);
  };
  set("q", filters.q.trim());
  set("where", filters.where.trim());
  set("workplace", filters.workplace.join(LIST_SEPARATOR));
  set("level", filters.seniority.join(LIST_SEPARATOR));
  set("type", filters.employment.join(LIST_SEPARATOR));
  set("source", filters.source.join(LIST_SEPARATOR));
  if (filters.minPay > 0) set("pay", String(filters.minPay));
  if (filters.posted !== DEFAULT_FILTERS.posted) set("posted", filters.posted);
  if (filters.visa) set("visa", "1");
  if (filters.sort !== DEFAULT_FILTERS.sort) set("sort", filters.sort);
  if (filters.list !== DEFAULT_FILTERS.list) set("list", filters.list);
  return params.toString();
}

// ── Filtering ──────────────────────────────────────────────────────────

function includesText(haystack: string, needle: string) {
  const words = needle.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const text = haystack.toLowerCase();
  return words.every((word) => text.includes(word));
}

function postedHours(value: PostedWithin) {
  return POSTED_WITHIN.find((option) => option.value === value)?.hours ?? Number.POSITIVE_INFINITY;
}

function passes(job: Job, filters: JobFilters, skip?: RefinementKey) {
  if (
    filters.q &&
    !includesText(`${job.title} ${job.company} ${job.skills.join(" ")} ${job.summary}`, filters.q)
  )
    return false;
  if (
    filters.where &&
    !includesText(`${job.location} ${WORKPLACE_LABEL[job.workplace]}`, filters.where)
  )
    return false;
  if (
    skip !== "workplace" &&
    filters.workplace.length &&
    !filters.workplace.includes(job.workplace)
  )
    return false;
  if (
    skip !== "seniority" &&
    filters.seniority.length &&
    !filters.seniority.includes(job.seniority)
  )
    return false;
  if (
    skip !== "employment" &&
    filters.employment.length &&
    !filters.employment.includes(job.employment)
  )
    return false;
  if (skip !== "source" && filters.source.length && !filters.source.includes(job.source))
    return false;
  if (skip !== "minPay" && filters.minPay > 0 && annualPay(job.pay, "max") < filters.minPay)
    return false;
  if (skip !== "posted" && job.postedHoursAgo > postedHours(filters.posted)) return false;
  if (skip !== "visa" && filters.visa && !job.visa) return false;
  return true;
}

export function filterJobs(jobs: Job[], filters: JobFilters) {
  return jobs.filter((job) => passes(job, filters));
}

type FacetKey = "workplace" | "seniority" | "employment" | "source";
type FacetValue<K extends FacetKey> = Job[K];

/**
 * How many jobs each option would show, given every other active filter —
 * the numbers beside each checkbox.
 */
export function facetCounts<K extends FacetKey>(jobs: Job[], filters: JobFilters, key: K) {
  const counts = new Map<FacetValue<K>, number>();
  for (const job of jobs) {
    if (!passes(job, filters, key)) continue;
    counts.set(job[key], (counts.get(job[key]) ?? 0) + 1);
  }
  return counts;
}

export function sortJobs(jobs: Job[], sort: SortKey, scoreOf: (job: Job) => number) {
  const sorted = [...jobs];
  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => a.postedHoursAgo - b.postedHoursAgo);
    case "pay":
      return sorted.sort((a, b) => annualPay(b.pay, "max") - annualPay(a.pay, "max"));
    case "applicants":
      return sorted.sort((a, b) => a.applicants - b.applicants);
    default:
      return sorted.sort((a, b) => scoreOf(b) - scoreOf(a) || a.postedHoursAgo - b.postedHoursAgo);
  }
}

/** Up to `limit` other jobs that share the most skills with this one. */
export function similarJobs(job: Job, jobs: Job[], limit: number) {
  const skills = new Set(job.skills);
  return jobs
    .filter((other) => other.id !== job.id)
    .map((other) => ({ other, shared: other.skills.filter((skill) => skills.has(skill)).length }))
    .filter(({ shared }) => shared > 0)
    .sort((a, b) => b.shared - a.shared || a.other.postedHoursAgo - b.other.postedHoursAgo)
    .slice(0, limit)
    .map(({ other }) => other);
}
