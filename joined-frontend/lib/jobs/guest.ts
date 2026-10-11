import { ROUTES, signInHref } from "@/lib/routes";
import { DEFAULT_FILTERS, serializeFilters, type JobFilters, type SortKey } from "./search";

/** Visitors see the newest jobs. Matches backend-core/jobs SearchSortNewest. */
export const GUEST_SORT: SortKey = "newest";

/** The one search a visitor can see: the first page of the newest jobs, nothing refined. */
export const GUEST_FILTERS: JobFilters = { ...DEFAULT_FILTERS, sort: GUEST_SORT };

export function isGuestView(filters: JobFilters, page: number) {
  return page === 1 && serializeFilters(filters) === serializeFilters(GUEST_FILTERS);
}

/**
 * Sign in, then run this search. The visitor's newest-first order is dropped,
 * so the account lands on its own default sort.
 */
export function signInToSearch(filters: JobFilters, page: number) {
  const sort = filters.sort === GUEST_SORT ? DEFAULT_FILTERS.sort : filters.sort;
  const params = new URLSearchParams(serializeFilters({ ...filters, sort }));
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return signInHref(query ? `${ROUTES.search}?${query}` : ROUTES.search);
}
