"use client";

import { useEffect, useState } from "react";
import type { Job } from "@/lib/jobs";
import { loadJob } from "@/lib/jobs/search-action";

const DETAIL_ERROR = "Could not load this job’s details.";

type Loaded = { id: string; job: Job | null; error: string | null };

/**
 * The full details for one job. Re-selecting the same job does not refetch, and an
 * answer for a job you've since left is dropped, so stale details never flash in.
 */
export function useJobDetail(id: string | undefined) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let active = true;
    loadJob(id)
      .then((job) => active && setLoaded({ id, job, error: null }))
      .catch(() => active && setLoaded({ id, job: null, error: DETAIL_ERROR }));
    return () => {
      active = false;
    };
  }, [id, attempt]);

  const current = id && loaded?.id === id ? loaded : null;
  return {
    /** Null until loaded, or when the job has no richer record than its card. */
    job: current?.job ?? null,
    isLoading: Boolean(id) && current === null,
    error: current?.error ?? null,
    retry: () => {
      setLoaded(null);
      setAttempt((value) => value + 1);
    },
  };
}
