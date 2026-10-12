"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@joined/scout";
import {
  forgetAdminQuery,
  pendingAdminQuery,
  prefetchAdminPath,
  readAdminQuery,
  seedAdminQuery,
  trackAdminQuery,
  warmAdminQuery,
} from "@/lib/admin-query-cache";
import { adminFetch } from "@/lib/api";

type Snapshot<T> = {
  key: string;
  result: T | null;
  error: string | null;
  errorStatus: number | null;
};

export type AdminQueryOptions<T> = {
  /** Server-rendered value for `initialPath`, shown on the first paint. */
  initial?: T;
  initialPath?: string;
};

function cacheKey(path: string, epoch: number) {
  return `${path}\n${epoch}`;
}

/**
 * Loads an admin API path in the browser and keeps the last result on screen
 * while the next one loads. A fresh cached page is shown immediately.
 * reload() fetches the same path again.
 */
export function useAdminQuery<T>(path: string, options?: AdminQueryOptions<T>) {
  const initialPath = options?.initialPath;
  const initialValue = options?.initial;
  const initial = initialValue !== undefined && initialPath === path ? initialValue : undefined;
  const [epoch, setEpoch] = useState(0);
  const key = cacheKey(path, epoch);
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(() =>
    initial !== undefined ? { key, result: initial, error: null, errorStatus: null } : null,
  );
  const seeded = useRef(false);
  const cached = path ? readAdminQuery<T>(path) : null;
  const settled = path && snapshot?.key === key ? snapshot : null;

  useEffect(() => {
    if (!path) return;
    if (!seeded.current && initialPath && initialValue !== undefined) {
      seeded.current = true;
      seedAdminQuery(initialPath, initialValue);
    }
    if (readAdminQuery<T>(path)?.fresh) return;
    let cancelled = false;
    const task = pendingAdminQuery<T>(path) ?? trackAdminQuery(path, adminFetch<T>(path));
    task.then(
      (result) => {
        if (!cancelled) setSnapshot({ key, result, error: null, errorStatus: null });
      },
      (cause: unknown) => {
        if (cancelled) return;
        setSnapshot({
          key,
          result: null,
          error: cause instanceof Error ? cause.message : "Could not load",
          errorStatus: cause instanceof ApiError ? cause.status : null,
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [initialPath, initialValue, key, path]);

  const idle = !path;
  const loading = !idle && !settled && !cached && initial === undefined;
  const reload = useCallback(() => {
    if (path) forgetAdminQuery(path);
    setEpoch((value) => value + 1);
  }, [path]);

  const result = idle
    ? null
    : settled
      ? settled.result
      : cached
        ? cached.result
        : initial !== undefined
          ? initial
          : (snapshot?.result ?? null);

  return {
    result,
    loading,
    error: idle || !settled ? null : settled.error,
    errorStatus: idle || !settled ? null : settled.errorStatus,
    reload,
  };
}

/** Fetches the next page into the cache so the pager click does not wait. */
export function useWarmNextPage(path: string, page: number, pageSize: number, total?: number) {
  const next = path ? prefetchAdminPath(path, page, pageSize, total) : null;
  useEffect(() => {
    warmAdminQuery(next, (target) => adminFetch(target));
  }, [next]);
}
