"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";

type Snapshot<T> = { key: string; result: T | null; error: string | null };

/**
 * Loads an admin API path in the browser and keeps the last result on screen
 * while the next one loads. reload() fetches the same path again.
 */
export function useAdminQuery<T>(path: string) {
  const [reloadToken, setReloadToken] = useState(0);
  const key = `${path}\n${reloadToken}`;
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    adminFetch<T>(path, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setSnapshot({ key, result, error: null });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setSnapshot({
          key,
          result: null,
          error: cause instanceof Error ? cause.message : "Could not load",
        });
      });
    return () => controller.abort();
  }, [key, path]);

  const loading = snapshot?.key !== key;
  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  return {
    result: snapshot?.result ?? null,
    loading,
    error: loading ? null : (snapshot?.error ?? null),
    reload,
  };
}
