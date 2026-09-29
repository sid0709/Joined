"use client";

import { useEffect, useState } from "react";

import type { JobMatch, MatchResult } from "@openseat/scout";

import { PRECHECK_DELAY_MS } from "@/lib/config";
import { scoutSend } from "@/lib/scout/client";

export type MatchesState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "done"; matches: JobMatch[] }
  | { phase: "invalid"; message: string };

const URL_HINT = /^(https?:\/\/)?[^\s/]+\.[^\s/]+/i;

/** Looks up existing jobs once the apply link, company, and title are filled. */
export function useMatches(
  url: string,
  companyId: string,
  companyName: string,
  title: string,
): MatchesState {
  const [state, setState] = useState<MatchesState>({ phase: "idle" });
  const trimmedUrl = url.trim();
  const trimmedCompany = companyName.trim();
  const trimmedTitle = title.trim();
  const ready = URL_HINT.test(trimmedUrl) && trimmedCompany.length >= 2 && trimmedTitle.length >= 2;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setState({ phase: "checking" });
      scoutSend<MatchResult>("/submissions/matches", "POST", {
        url: trimmedUrl,
        company_id: companyId,
        company_name: trimmedCompany,
        title: trimmedTitle,
      })
        .then((result) => {
          if (!cancelled) setState({ phase: "done", matches: result.matches ?? [] });
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setState({
              phase: "invalid",
              message:
                error instanceof Error ? error.message : "Could not check for existing jobs.",
            });
          }
        });
    }, PRECHECK_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ready, trimmedUrl, companyId, trimmedCompany, trimmedTitle]);

  if (!ready) return { phase: "idle" };
  return state;
}
