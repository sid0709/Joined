import type { TableSort } from "@joined/design-system";

/** Completion at or above this is a complete page or job. */
export const COMPLETION_HIGH = 80;
/** Completion at or above this, and below high, is partial; below it is thin. */
export const COMPLETION_MID = 50;
const COMPLETION_MAX = 100;

export type FilterOption = { value: string; label: string };

/** A directory filter: a query parameter and the choices for it, "" meaning any. */
export type DirectoryFilter = {
  param: string;
  label: string;
  options: FilterOption[];
};

/** Completion ranges as "min-max" values for the completion filter. */
export const COMPLETION_OPTIONS: FilterOption[] = [
  { value: "", label: "Any completion" },
  { value: `${COMPLETION_HIGH}-${COMPLETION_MAX}`, label: `Complete (${COMPLETION_HIGH}%+)` },
  {
    value: `${COMPLETION_MID}-${COMPLETION_HIGH - 1}`,
    label: `Partial (${COMPLETION_MID}–${COMPLETION_HIGH - 1}%)`,
  },
  { value: `0-${COMPLETION_MID - 1}`, label: `Thin (under ${COMPLETION_MID}%)` },
];

/** The completion filter's URL parameter; the API takes it as minCompletion and maxCompletion. */
export const COMPLETION_PARAM = "completion";

export function yesNoOptions(any: string, yes: string, no: string): FilterOption[] {
  return [
    { value: "", label: any },
    { value: "yes", label: yes },
    { value: "no", label: no },
  ];
}

/** Choices for a filter over a fixed list of values. */
export function choiceOptions(any: string, values: readonly string[]): FilterOption[] {
  return [{ value: "", label: any }, ...values.map((value) => ({ value, label: value }))];
}

export function completionTier(completion: number): "success" | "warning" | "error" {
  if (completion >= COMPLETION_HIGH) return "success";
  if (completion >= COMPLETION_MID) return "warning";
  return "error";
}

/** The API query for a directory page: the URL's values, with the completion range split. */
export function directoryParams(
  current: URLSearchParams,
  filters: DirectoryFilter[],
  page: number,
  pageSize: number,
) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  for (const key of ["q", "sort", "dir", ...filters.map((filter) => filter.param)]) {
    const value = current.get(key);
    if (value) params.set(key, value);
  }
  const [min, max] = (current.get(COMPLETION_PARAM) ?? "").split("-");
  if (min && max) {
    params.set("minCompletion", min);
    params.set("maxCompletion", max);
  }
  return params;
}

/** The table's sort, read from the URL. */
export function tableSort(current: URLSearchParams, fallback: TableSort): TableSort {
  const key = current.get("sort");
  if (!key) return fallback;
  return { key, direction: current.get("dir") === "desc" ? "desc" : "asc" };
}

/** URL values for a new table sort; clearing it returns to the page's default. */
export function sortValues(sort: TableSort | null) {
  return { sort: sort?.key ?? null, dir: sort?.direction ?? null, page: 1 };
}
