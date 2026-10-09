"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  DEFAULT_FILTERS,
  GOOD_MATCH,
  SEARCH_DEBOUNCE_MS,
  SEARCH_PAGE_SIZE,
  clearRefinements,
  countRefinements,
  scoreFor,
  serializeFilters,
  sortJobs,
  type Job,
  type JobFilters,
  type JobSearchPage,
  type ListKey,
} from "@/lib/jobs";
import type { MatchProfile } from "@/lib/jobs/match";
import { searchJobs } from "@/lib/jobs/search-action";
import { saveJob, unsaveJob } from "@/lib/me/pipeline";

export const PAGE_SIZE = SEARCH_PAGE_SIZE;

function toggle(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function isTypedQuery(patch: Partial<JobFilters>) {
  return Object.keys(patch).every((key) => key === "q" || key === "where");
}

/**
 * State for the job search page: filters mirrored to the URL, one server page
 * of results, the lists a hunter keeps, the selected job, and paging.
 */
export function useJobSearch(
  initial: JobFilters,
  initialResult: JobSearchPage,
  lists: { savedIds: string[]; appliedIds: string[]; signedIn: boolean; profile?: MatchProfile },
) {
  const score = useCallback((job: Job) => scoreFor(job, lists.profile), [lists.profile]);
  const [filters, setFilters] = useState<JobFilters>(initial);
  const [savedIds, setSavedIds] = useState<string[]>(lists.savedIds);
  const [appliedIds, setAppliedIds] = useState<string[]>(lists.appliedIds);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPageState] = useState(initialResult.page);
  const [result, setResult] = useState(initialResult);
  const [matchTotal, setMatchTotal] = useState(initial.list === "saved" ? 0 : initialResult.total);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIdsRef = useRef(savedIds);
  const filtersRef = useRef(filters);

  useEffect(() => {
    savedIdsRef.current = savedIds;
    filtersRef.current = filters;
  }, [savedIds, filters]);

  useEffect(() => {
    const params = new URLSearchParams(serializeFilters(filters));
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    const { pathname, search } = window.location;
    const next = query ? `${pathname}?${query}` : pathname;
    if (next !== `${pathname}${search}`) window.history.replaceState(null, "", next);
  }, [filters, page]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const load = useCallback((nextFilters: JobFilters, nextPage: number) => {
    const id = ++request.current;
    startTransition(async () => {
      try {
        const data = await searchJobs(nextFilters, nextPage, savedIdsRef.current);
        if (id !== request.current) return;
        setResult(data);
        if (nextFilters.list !== "saved") setMatchTotal(data.total);
        setError(null);
      } catch (cause) {
        if (id !== request.current) return;
        setError(cause instanceof Error ? cause.message : "Could not load jobs");
      }
    });
  }, []);

  const schedule = useCallback(
    (nextFilters: JobFilters, nextPage: number, immediate: boolean) => {
      if (timer.current) clearTimeout(timer.current);
      if (immediate) {
        load(nextFilters, nextPage);
        return;
      }
      timer.current = setTimeout(() => load(nextFilters, nextPage), SEARCH_DEBOUNCE_MS);
    },
    [load],
  );

  const update = useCallback(
    (patch: Partial<JobFilters>) => {
      const next = { ...filtersRef.current, ...patch };
      filtersRef.current = next;
      setFilters(next);
      setPageState(1);
      schedule(next, 1, !isTypedQuery(patch));
    },
    [schedule],
  );

  const reset = useCallback(() => {
    const next = {
      ...DEFAULT_FILTERS,
      sort: filtersRef.current.sort,
      list: filtersRef.current.list,
    };
    filtersRef.current = next;
    setFilters(next);
    setPageState(1);
    schedule(next, 1, true);
  }, [schedule]);

  const clearAll = useCallback(() => {
    const next = clearRefinements(filtersRef.current);
    filtersRef.current = next;
    setFilters(next);
    setPageState(1);
    schedule(next, 1, true);
  }, [schedule]);

  const setPage = useCallback(
    (nextPage: number) => {
      setPageState(nextPage);
      schedule(filters, nextPage, true);
    },
    [filters, schedule],
  );

  const jobs = result.jobs.filter((job) => !hiddenIds.includes(job.id));
  const ranked =
    filters.sort === "relevance" && filters.q.trim() === ""
      ? sortJobs(jobs, "relevance", score)
      : jobs;
  const pageJobs =
    filters.list === "recommended" ? ranked.filter((job) => score(job) >= GOOD_MATCH) : ranked;
  const total = filters.list === "recommended" ? pageJobs.length : result.total;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selected = pageJobs.find((job) => job.id === selectedId) ?? pageJobs[0] ?? null;

  const listCounts: Record<ListKey, number | null> = {
    all: filters.list === "saved" ? matchTotal : result.total,
    recommended: filters.list === "recommended" ? pageJobs.length : null,
    saved: savedIds.length,
  };

  const toggleSave = async (id: string) => {
    if (!lists.signedIn) return false;
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
    reset,
    clearAll,
    refinementCount: countRefinements(filters),
    results: pageJobs,
    pageResults: pageJobs,
    total,
    page,
    pageCount: filters.list === "recommended" ? 1 : pageCount,
    setPage,
    listCounts,
    error,
    selected,
    select: setSelectedId,
    savedIds,
    toggleSave,
    appliedIds,
    markApplied: (id: string) => setAppliedIds((ids) => (ids.includes(id) ? ids : [...ids, id])),
    hide: (id: string) => setHiddenIds((ids) => [...ids, id]),
    unhide: (id: string) => setHiddenIds((ids) => ids.filter((item) => item !== id)),
    signedIn: lists.signedIn,
  };
}

export type JobSearchState = ReturnType<typeof useJobSearch>;
