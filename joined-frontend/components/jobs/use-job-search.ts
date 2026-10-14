"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_FILTERS,
  SEARCH_DEBOUNCE_MS,
  SEARCH_PAGE_SIZE,
  clearRefinements,
  countRefinements,
  serializeFilters,
  type JobFilters,
  type JobSearchPage,
  type ListKey,
} from "@/lib/jobs";
import { signInToSearch } from "@/lib/jobs/guest";
import { searchJobs } from "@/lib/jobs/search-action";
import { saveJob, unsaveJob } from "@/lib/me/pipeline";

export const PAGE_SIZE = SEARCH_PAGE_SIZE;

function toggle(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function isTypedQuery(patch: Partial<JobFilters>) {
  return Object.keys(patch).every((key) => key === "q" || key === "where");
}

/** Sends a visitor to sign in, then back to the search they asked for. */
function needAccount(filters: JobFilters, page: number) {
  window.location.assign(signInToSearch(filters, page));
}

const NO_FITS: NonNullable<JobSearchPage["fits"]> = {};

/**
 * State for the job search page: filters mirrored to the URL, one server page
 * of results in the server's ranked order, the lists a hunter keeps, the
 * selected job, and paging. A visitor only sees the newest jobs: any other
 * search sends them to sign in and brings them back to it.
 */
export function useJobSearch(
  initial: JobFilters,
  initialResult: JobSearchPage,
  lists: { savedIds: string[]; appliedIds: string[]; signedIn: boolean; loadError?: string },
) {
  const [filters, setFilters] = useState<JobFilters>(initial);
  const [savedIds, setSavedIds] = useState<string[]>(lists.savedIds);
  const [appliedIds, setAppliedIds] = useState<string[]>(lists.appliedIds);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPageState] = useState(initialResult.page);
  const [result, setResult] = useState(initialResult);
  const [matchTotal, setMatchTotal] = useState(initial.list === "all" ? initialResult.total : 0);
  const [error, setError] = useState<string | null>(lists.loadError || null);
  const [isLoading, setLoading] = useState(false);
  const request = useRef(0);
  // The key of the request now in flight, so a repeated click doesn't send it twice.
  const inflight = useRef<string | null>(null);
  const pageRef = useRef(page);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIdsRef = useRef(savedIds);
  const filtersRef = useRef(filters);
  const { signedIn } = lists;

  useEffect(() => {
    savedIdsRef.current = savedIds;
    filtersRef.current = filters;
    pageRef.current = page;
  }, [savedIds, filters, page]);

  useEffect(() => {
    if (!signedIn) return;
    const params = new URLSearchParams(serializeFilters(filters));
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    const { pathname, search } = window.location;
    const next = query ? `${pathname}?${query}` : pathname;
    if (next !== `${pathname}${search}`) window.history.replaceState(null, "", next);
  }, [signedIn, filters, page]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const load = useCallback(async (nextFilters: JobFilters, nextPage: number) => {
    const key = JSON.stringify([nextFilters, nextPage]);
    if (inflight.current === key) return;
    inflight.current = key;
    const id = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const data = await searchJobs(nextFilters, nextPage, savedIdsRef.current);
      if (id !== request.current) return;
      setResult(data);
      if (nextFilters.list === "all") setMatchTotal(data.total);
    } catch (cause) {
      if (id !== request.current) return;
      setError(cause instanceof Error ? cause.message : "Could not load jobs");
    } finally {
      // Only the newest request settles the loading state; an older answer is ignored.
      if (id === request.current) {
        inflight.current = null;
        setLoading(false);
      }
    }
  }, []);

  const schedule = useCallback(
    (nextFilters: JobFilters, nextPage: number, immediate: boolean) => {
      if (timer.current) clearTimeout(timer.current);
      if (immediate) {
        void load(nextFilters, nextPage);
        return;
      }
      timer.current = setTimeout(() => void load(nextFilters, nextPage), SEARCH_DEBOUNCE_MS);
    },
    [load],
  );

  /** Shows `next` from its first page. A visitor's edits stay on screen and are not searched. */
  const commit = useCallback(
    (next: JobFilters, immediate: boolean) => {
      filtersRef.current = next;
      setFilters(next);
      setPageState(1);
      if (signedIn) schedule(next, 1, immediate);
    },
    [signedIn, schedule],
  );

  const update = useCallback(
    (patch: Partial<JobFilters>) => {
      const next = { ...filtersRef.current, ...patch };
      const typed = isTypedQuery(patch);
      // A visitor can type; a filter, sort, or list change asks them to sign in first.
      if (!signedIn && !typed) {
        needAccount(next, 1);
        return;
      }
      commit(next, !typed);
    },
    [signedIn, commit],
  );

  /** Runs the search box now, with `patch` applied. A visitor signs in first. */
  const submit = useCallback(
    (patch: Partial<JobFilters> = {}) => {
      const next = { ...filtersRef.current, ...patch };
      if (!signedIn) {
        needAccount(next, 1);
        return;
      }
      commit(next, true);
    },
    [signedIn, commit],
  );

  const reset = useCallback(() => {
    commit(
      { ...DEFAULT_FILTERS, sort: filtersRef.current.sort, list: filtersRef.current.list },
      true,
    );
  }, [commit]);

  const clearAll = useCallback(() => {
    commit(clearRefinements(filtersRef.current), true);
  }, [commit]);

  const setPage = useCallback(
    (nextPage: number) => {
      if (!signedIn) {
        needAccount(filtersRef.current, nextPage);
        return;
      }
      setPageState(nextPage);
      schedule(filters, nextPage, true);
    },
    [signedIn, filters, schedule],
  );

  const retry = useCallback(() => {
    void load(filtersRef.current, pageRef.current);
  }, [load]);

  const pageJobs = result.jobs.filter((job) => !hiddenIds.includes(job.id));
  const total = result.total;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selected = pageJobs.find((job) => job.id === selectedId) ?? pageJobs[0] ?? null;

  const listCounts: Record<ListKey, number | null> = {
    all: filters.list === "all" ? result.total : matchTotal || null,
    recommended: filters.list === "recommended" ? result.total : null,
    saved: savedIds.length,
  };

  /** Where a job sits in the full ranked list, for interaction logs. */
  const positionOf = (id: string) => {
    const index = result.jobs.findIndex((job) => job.id === id);
    return index < 0 ? -1 : (page - 1) * PAGE_SIZE + index;
  };

  const toggleSave = async (id: string) => {
    if (!signedIn) return false;
    const wasSaved = savedIds.includes(id);
    setSavedIds((ids) => toggle(ids, id));
    try {
      if (wasSaved) await unsaveJob(id);
      else await saveJob(id);
      return true;
    } catch {
      setSavedIds((ids) => toggle(ids, id));
      return false;
    }
  };

  return {
    filters,
    update,
    submit,
    reset,
    clearAll,
    refinementCount: countRefinements(filters),
    results: pageJobs,
    pageResults: pageJobs,
    total,
    page,
    pageCount,
    setPage,
    listCounts,
    error,
    isLoading,
    retry,
    selected,
    select: setSelectedId,
    savedIds,
    toggleSave,
    appliedIds,
    markApplied: (id: string) => setAppliedIds((ids) => (ids.includes(id) ? ids : [...ids, id])),
    hide: (id: string) => setHiddenIds((ids) => [...ids, id]),
    unhide: (id: string) => setHiddenIds((ids) => ids.filter((item) => item !== id)),
    signedIn,
    fits: result.fits ?? NO_FITS,
    facets: result.facets,
    suggestions: result.suggestions ?? [],
    rankingId: result.rankingId,
    exact: result.exact ?? true,
    positionOf,
  };
}

export type JobSearchState = ReturnType<typeof useJobSearch>;
