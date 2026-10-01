"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isPending, type Submission } from "@joined/scout";
import { STATUS_POLL_MS } from "@/lib/config";
import { scoutFetch } from "@/lib/scout/client";

/**
 * Watches a submission while its automatic checks run, then re-renders the page
 * once. Polling the small JSON endpoint keeps full page renders to one.
 */
export function RefreshWhilePending({ id, pending }: { id: string; pending: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!pending) return;
    let stopped = false;
    let timer = 0;
    const tick = async () => {
      try {
        const current = await scoutFetch<Submission>(`/submissions/${encodeURIComponent(id)}`);
        if (stopped) return;
        if (!isPending(current.status)) {
          router.refresh();
          return;
        }
      } catch {
        // A failed poll just waits for the next one.
      }
      if (!stopped) timer = window.setTimeout(() => void tick(), STATUS_POLL_MS);
    };
    timer = window.setTimeout(() => void tick(), STATUS_POLL_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [id, pending, router]);
  return null;
}
