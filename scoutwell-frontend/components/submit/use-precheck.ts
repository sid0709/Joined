"use client";

import { useEffect, useState } from "react";
import type { Precheck } from "@joined/scout";
import { PRECHECK_DELAY_MS } from "@/lib/config";
import { scoutSend } from "@/lib/scout/client";

export type PrecheckState =
  | { phase: "idle" }
  | { phase: "checking"; url: string }
  | { phase: "done"; url: string; result: Precheck }
  | { phase: "invalid"; url: string; message: string };

const URL_HINT = /^(https?:\/\/)?[^\s/]+\.[^\s/]+/i;

/** Checks a link a moment after the scout stops typing it. */
export function usePrecheck(url: string): PrecheckState {
  const [state, setState] = useState<PrecheckState>({ phase: "idle" });
  const trimmed = url.trim();

  useEffect(() => {
    if (!URL_HINT.test(trimmed)) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setState({ phase: "checking", url: trimmed });
      scoutSend<Precheck>("/submissions/precheck", "POST", { url: trimmed })
        .then((result) => {
          if (!cancelled) setState({ phase: "done", url: trimmed, result });
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setState({
              phase: "invalid",
              url: trimmed,
              message: error instanceof Error ? error.message : "Could not check this link.",
            });
          }
        });
    }, PRECHECK_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmed]);

  if (!URL_HINT.test(trimmed)) return { phase: "idle" };
  if (state.phase !== "idle" && state.url !== trimmed) return { phase: "checking", url: trimmed };
  return state;
}
