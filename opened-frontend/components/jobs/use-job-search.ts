"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { INITIAL_SAVED_JOB_IDS } from "@/lib/account";
import {
  DEFAULT_FILTERS,
  GOOD_MATCH,
  JOBS,
  clearRefinements,
  countRefinements,
  filterJobs,
  scoreFor,
  serializeFilters,
  sortJobs,
  type JobFilters,
  type ListKey,
} from "@/lib/jobs";

export const PAGE_SIZE = 8;

function toggle(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

/**
 * State for the job search page: filters mirrored to the URL, the lists a
 * hunter keeps (saved, applied, hidden), the selected job, and paging.
 */
export function useJobSearch(initial: JobFilters) {
  const [filters, setFilters] = useState<JobFilters>(initial);
  const [savedIds, setSavedIds] = useState<string[]>(INITIAL_SAVED_JOB_IDS);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Keep the address bar shareable without a navigation.
  useEffect(() => {
    const query = serializeFilters(filters);
    const { pathname, search } = window.location;
    const next = query ? `${pathname}?${query}` : pathname;
    if (next !== `${pathname}${search}`) window.history.replaceState(null, "", next);
  }, [filters]);

  const update = useCallback((patch: Partial<JobFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }, []);

  const reset = useCallback(() => {
    setFilters((current) => ({ ...DEFAULT_FILTERS, sort: current.sort, list: current.list }));
    setPage(1);
  }, []);

  const clearAll = useCallback(() => {
    setFilters((current) => clearRefinements(current));
    setPage(1);
  }, []);

  const visibleJobs = useMemo(() => JOBS.filter((job) => !hiddenIds.includes(job.id)), [hiddenIds]);

  /** Jobs that pass the search and refinements, before the list tab narrows them. */
  const matching = useMemo(() => filterJobs(visibleJobs, filters), [visibleJobs, filters]);

  const listCounts: Record<ListKey, number> = useMemo(
    () => ({
      all: matching.length,
      recommended: matching.filter((job) => scoreFor(job) >= GOOD_MATCH).length,
      saved: matching.filter((job) => savedIds.includes(job.id)).length,
    }),
    [matching, savedIds],
  );

  const results = useMemo(() => {
    const listed = matching.filter((job) => {
      if (filters.list === "recommended") return scoreFor(job) >= GOOD_MATCH;
      if (filters.list === "saved") return savedIds.includes(job.id);
      return true;
    });
    return sortJobs(listed, filters.sort, scoreFor);
  }, [matching, filters.list, filters.sort, savedIds]);

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageResults = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selected = results.find((job) => job.id === selectedId) ?? pageResults[0] ?? null;

  return {
    filters,
    update,
    reset,
    clearAll,
    refinementCount: countRefinements(filters),
    /** Jobs the facets count against — hidden jobs never come back through a filter. */
    visibleJobs,
    results,
    pageResults,
    page: currentPage,
    pageCount,
    setPage,
    listCounts,
    selected,
    select: setSelectedId,
    savedIds,
    toggleSave: (id: string) => setSavedIds((ids) => toggle(ids, id)),
    appliedIds,
    markApplied: (id: string) => setAppliedIds((ids) => (ids.includes(id) ? ids : [...ids, id])),
    hide: (id: string) => setHiddenIds((ids) => [...ids, id]),
    unhide: (id: string) => setHiddenIds((ids) => ids.filter((item) => item !== id)),
  };
}

export type JobSearchState = ReturnType<typeof useJobSearch>;
