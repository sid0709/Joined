"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@joined/scout";
import { adminFetch } from "@/lib/api";

type Snapshot<T> = {
  key: string;
  result: T | null;
  error: string | null;
  errorStatus: number | null;
};

/**
 * Loads an admin API path in the browser and keeps the last result on screen
 * while the next one loads. reload() fetches the same path again.
 */
export function useAdminQuery<T>(path: string) {
  const [reloadToken, setReloadToken] = useState(0);
  const key = `${path}\n${reloadToken}`;
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    adminFetch<T>(path, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted)
          setSnapshot({ key, result, error: null, errorStatus: null });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setSnapshot({
          key,
          result: null,
          error: cause instanceof Error ? cause.message : "Could not load",
          errorStatus: cause instanceof ApiError ? cause.status : null,
        });
      });
    return () => controller.abort();
  }, [key, path]);

  const idle = !path;
  const loading = !idle && snapshot?.key !== key;
  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  return {
    result: idle ? null : (snapshot?.result ?? null),
    loading,
    error: idle || loading ? null : (snapshot?.error ?? null),
    errorStatus: idle || loading ? null : (snapshot?.errorStatus ?? null),
    reload,
  };
}
