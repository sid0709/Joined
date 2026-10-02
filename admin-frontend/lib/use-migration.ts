"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminFetch, adminSend } from "@/lib/api";
import {
  isRunning,
  migrationCancelPath,
  MIGRATION_PATH,
  MIGRATION_POLL_MS,
  migrationTaskPath,
  type MigrationRun,
  type MigrationStart,
  type MigrationStatus,
  type MigrationTask,
} from "@/lib/migration";

/**
 * The migration's counts and runs. Polls while any step runs, and bumps `finished`
 * each time a run ends so lists built from its output can reload.
 */
export function useMigration() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(0);
  const [refreshToken, setRefreshToken] = useState(0);
  const running = useRef(new Set<MigrationTask>());

  const refresh = useCallback(() => setRefreshToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    adminFetch<MigrationStatus>(MIGRATION_PATH, { signal: controller.signal })
      .then((next) => {
        if (controller.signal.aborted) return;
        const nowRunning = new Set(
          Object.values(next.runs)
            .filter(isRunning)
            .map((run) => run.task),
        );
        const ended = [...running.current].some((task) => !nowRunning.has(task));
        running.current = nowRunning;
        if (ended) setFinished((count) => count + 1);
        setStatus(next);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not load the migration");
        }
      });
    return () => controller.abort();
  }, [refreshToken]);

  const anyRunning = Object.values(status?.runs ?? {}).some(isRunning);
  useEffect(() => {
    if (!anyRunning) return;
    const timer = setTimeout(refresh, MIGRATION_POLL_MS);
    return () => clearTimeout(timer);
  }, [anyRunning, refreshToken, refresh]);

  const start = useCallback(
    async (task: MigrationTask, body: MigrationStart = {}) => {
      const run = await adminSend<MigrationRun>(migrationTaskPath(task), "POST", body);
      running.current.add(task);
      refresh();
      return run;
    },
    [refresh],
  );

  const cancel = useCallback(
    async (task: MigrationTask) => {
      await adminSend<MigrationRun>(migrationCancelPath(task), "POST");
      refresh();
    },
    [refresh],
  );

  return { status, error, finished, start, cancel, refresh };
}
