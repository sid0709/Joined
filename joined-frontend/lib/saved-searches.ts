import { EMPLOYMENTS, SENIORITIES, WORKPLACES } from "@joined/job-schema";
import {
  DEFAULT_FILTERS,
  PAY_FLOOR_MAX,
  POSTED_WITHIN,
  SORTS,
  type JobFilters,
  type JobSource,
  type PostedWithin,
  type SortKey,
} from "@/lib/jobs";
import { CompanyRequestError, meGet, meSend } from "@/lib/me/client";
import { DEFAULT_CURRENCY } from "@/lib/profile";

/** Matches backend-core/savedsearch.MaxPerUser. */
export const MAX_SAVED_SEARCHES = 20;
/** Matches backend-core/savedsearch.MaxNameLength. */
export const MAX_SAVED_SEARCH_NAME_LENGTH = 80;
/** Matches backend-core/savedsearch.MaxQueryLength. */
export const MAX_SAVED_SEARCH_QUERY_LENGTH = 200;
export const DEFAULT_SAVED_SEARCH_NAME = "Saved search";
/** /v1/search/jobs source value for scouted (hidden) jobs. */
export const HIDDEN_JOB_SOURCE = "hidden";
export const SAVED_SEARCH_LIMIT_STATUS = 409;

export const SAVED_SEARCH_CADENCES = ["off", "daily", "weekly"] as const;
export type SavedSearchCadence = (typeof SAVED_SEARCH_CADENCES)[number];

export const SAVED_SEARCH_CADENCE_OPTIONS: { value: SavedSearchCadence; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

const POSTED_DAYS: Record<PostedWithin, number> = {
  any: 0,
  "24h": 1,
  "3d": 3,
  "7d": 7,
  "14d": 14,
};

const JOB_SOURCES: readonly JobSource[] = ["direct", "aggregated", "scouted"];

export type SavedSearchFilters = {
  location?: string;
  workplace?: string;
  employment?: string;
  seniority?: string;
  company?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  postedDays?: number;
  remote?: boolean;
  sort?: string;
  source?: string;
};

export type SavedSearch = {
  id: string;
  userId: string;
  name: string;
  query: string;
  filters: SavedSearchFilters;
  alertFrequency: SavedSearchCadence;
  lastAlertedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedSearchInput = {
  name: string;
  query: string;
  filters: SavedSearchFilters;
  alertFrequency: SavedSearchCadence;
};

export type SavedSearchPatch = {
  name?: string;
  query?: string;
  filters?: SavedSearchFilters;
  alertFrequency?: SavedSearchCadence;
};

export function clampSavedSearchText(value: string, max: number) {
  return Array.from(value.trim()).slice(0, max).join("");
}

/** Saved-search alerts accept off, daily, and weekly. Instant is not an API value. */
export function savedSearchCadence(value: string): SavedSearchCadence | null {
  switch (value) {
    case "off":
    case "daily":
    case "weekly":
      return value;
    case "instant":
      return null;
    default:
      return null;
  }
}

export function isSavedSearchLimitError(error: unknown) {
  return error instanceof CompanyRequestError && error.status === SAVED_SEARCH_LIMIT_STATUS;
}

function oneOf<T extends string>(allowed: readonly T[], value: string | undefined): T | undefined {
  if (!value) return undefined;
  return allowed.find((item) => item === value);
}

function firstAllowed<T extends string>(
  values: readonly T[],
  allowed: readonly T[],
): T | undefined {
  return values.find((value) => allowed.includes(value));
}

function postedWithinForDays(days: number | undefined): PostedWithin {
  if (!days || days <= 0) return "any";
  const match = POSTED_WITHIN.find((option) => POSTED_DAYS[option.value] === days);
  return match?.value ?? "any";
}

function sortKey(value: string | undefined): SortKey | undefined {
  return oneOf(
    SORTS.map((option) => option.value),
    value,
  );
}

/** Browse filters → the step-34 body. Visa stays off the wire. */
export function filtersToSavedSearch(filters: JobFilters): {
  query: string;
  filters: SavedSearchFilters;
} {
  const workplace = firstAllowed(filters.workplace, WORKPLACES);
  const employment = firstAllowed(filters.employment, EMPLOYMENTS);
  const seniority = firstAllowed(filters.seniority, SENIORITIES);
  const hidden = filters.source.includes("scouted");
  const source = hidden ? HIDDEN_JOB_SOURCE : firstAllowed(filters.source, JOB_SOURCES);
  const salaryMin = filters.minPay > 0 ? Math.min(filters.minPay, PAY_FLOOR_MAX) : 0;
  const postedDays = POSTED_DAYS[filters.posted];
  const stored: SavedSearchFilters = {};
  if (filters.where.trim()) stored.location = filters.where.trim();
  if (workplace) stored.workplace = workplace;
  if (employment) stored.employment = employment;
  if (seniority) stored.seniority = seniority;
  if (salaryMin > 0) {
    stored.salaryMin = salaryMin;
    stored.currency = DEFAULT_CURRENCY;
  }
  if (postedDays > 0) stored.postedDays = postedDays;
  if (filters.workplace.includes("remote")) stored.remote = true;
  if (filters.sort !== DEFAULT_FILTERS.sort) stored.sort = filters.sort;
  if (source) stored.source = source;
  return {
    query: clampSavedSearchText(filters.q, MAX_SAVED_SEARCH_QUERY_LENGTH),
    filters: stored,
  };
}

/**
 * Apply a saved search onto browse filters. Visa is browse-only, so the
 * current visa toggle is kept when the saved record has no visa field.
 */
export function applySavedSearch(
  current: JobFilters,
  saved: Pick<SavedSearch, "query" | "filters">,
): JobFilters {
  const stored = saved.filters ?? {};
  const workplace = oneOf(WORKPLACES, stored.workplace);
  const employment = oneOf(EMPLOYMENTS, stored.employment);
  const seniority = oneOf(SENIORITIES, stored.seniority);
  const nextWorkplace = workplace ? [workplace] : [];
  if (stored.remote && !nextWorkplace.includes("remote")) nextWorkplace.unshift("remote");
  let source: JobFilters["source"] = [];
  if (stored.source === HIDDEN_JOB_SOURCE || stored.source === "scouted") source = ["scouted"];
  else {
    const jobSource = oneOf(JOB_SOURCES, stored.source);
    if (jobSource) source = [jobSource];
  }
  const minPay =
    stored.salaryMin && stored.salaryMin > 0 ? Math.min(stored.salaryMin, PAY_FLOOR_MAX) : 0;
  return {
    ...DEFAULT_FILTERS,
    q: saved.query ?? "",
    where: stored.location ?? "",
    workplace: nextWorkplace,
    employment: employment ? [employment] : [],
    seniority: seniority ? [seniority] : [],
    source,
    minPay,
    posted: postedWithinForDays(stored.postedDays),
    visa: current.visa,
    sort: sortKey(stored.sort) ?? DEFAULT_FILTERS.sort,
    list: current.list,
  };
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** True when a stored search is the same query and filters as the browse bar. */
export function sameSavedQuery(saved: Pick<SavedSearch, "query" | "filters">, filters: JobFilters) {
  const next = filtersToSavedSearch(filters);
  return saved.query === next.query && stable(saved.filters ?? {}) === stable(next.filters);
}

export function suggestSavedSearchName(filters: JobFilters) {
  const label = filters.q.trim() || filters.where.trim() || DEFAULT_SAVED_SEARCH_NAME;
  return clampSavedSearchText(label, MAX_SAVED_SEARCH_NAME_LENGTH) || DEFAULT_SAVED_SEARCH_NAME;
}

function assertCadence(value: string): SavedSearchCadence {
  const cadence = savedSearchCadence(value);
  if (!cadence) throw new Error("Saved search alerts are off, daily, or weekly");
  return cadence;
}

export async function listSavedSearches() {
  const body = await meGet<{ searches?: SavedSearch[] }>("/saved-searches");
  return (body.searches ?? []).map(normalizeSavedSearch);
}

export async function createSavedSearch(input: SavedSearchInput) {
  const created = await meSend<SavedSearch>("/saved-searches", "POST", {
    name:
      clampSavedSearchText(input.name, MAX_SAVED_SEARCH_NAME_LENGTH) || DEFAULT_SAVED_SEARCH_NAME,
    query: clampSavedSearchText(input.query, MAX_SAVED_SEARCH_QUERY_LENGTH),
    filters: input.filters,
    alertFrequency: assertCadence(input.alertFrequency),
  });
  return normalizeSavedSearch(created);
}

export async function updateSavedSearch(id: string, patch: SavedSearchPatch) {
  const body: SavedSearchPatch = {};
  if (patch.name !== undefined) {
    body.name =
      clampSavedSearchText(patch.name, MAX_SAVED_SEARCH_NAME_LENGTH) || DEFAULT_SAVED_SEARCH_NAME;
  }
  if (patch.query !== undefined) {
    body.query = clampSavedSearchText(patch.query, MAX_SAVED_SEARCH_QUERY_LENGTH);
  }
  if (patch.filters !== undefined) body.filters = patch.filters;
  if (patch.alertFrequency !== undefined) body.alertFrequency = assertCadence(patch.alertFrequency);
  const updated = await meSend<SavedSearch>(
    `/saved-searches/${encodeURIComponent(id)}`,
    "PATCH",
    body,
  );
  return normalizeSavedSearch(updated);
}

export function deleteSavedSearch(id: string) {
  return meSend<void>(`/saved-searches/${encodeURIComponent(id)}`, "DELETE");
}

function normalizeSavedSearch(search: SavedSearch): SavedSearch {
  return {
    ...search,
    filters: search.filters ?? {},
    alertFrequency: savedSearchCadence(search.alertFrequency) ?? "off",
  };
}
