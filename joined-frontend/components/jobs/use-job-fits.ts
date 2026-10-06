"use client";

import { useEffect, useState } from "react";
import { fetchJobFit, fetchJobFits, type JobFit } from "@/lib/jobs/fit";

/** Signed-in fit scores for the visible jobs. Guests and failed loads stay empty. */
export function useJobFits(signedIn: boolean, ids: string[]) {
  const [fits, setFits] = useState<Record<string, JobFit>>({});
  const key = [...new Set(ids.filter(Boolean))].sort().join("\n");

  useEffect(() => {
    if (!signedIn || key.length === 0) return;
    let cancelled = false;
    fetchJobFits(key.split("\n"))
      .then((rows) => {
        if (cancelled) return;
        setFits((current) => {
          const next = { ...current };
          for (const row of rows) next[row.jobId] = row;
          return next;
        });
      })
      .catch(() => {
        // Leave the badge off. Do not substitute a client score.
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, key]);

  if (!signedIn) return {};
  return fits;
}

/** One job page. Null until the API returns a score, and null for guests. */
export function useJobFit(signedIn: boolean, jobId: string) {
  const [fit, setFit] = useState<JobFit | null>(null);

  useEffect(() => {
    if (!signedIn || !jobId) return;
    let cancelled = false;
    fetchJobFit(jobId)
      .then((row) => {
        if (!cancelled) setFit(row);
      })
      .catch(() => {
        if (!cancelled) setFit(null);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, jobId]);

  if (!signedIn) return null;
  return fit;
}
