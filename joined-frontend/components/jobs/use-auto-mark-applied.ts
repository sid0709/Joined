"use client";

import { useSyncExternalStore } from "react";
import {
  getAutoMarkAppliedServerSnapshot,
  readAutoMarkApplied,
  subscribeAutoMarkApplied,
  writeAutoMarkApplied,
} from "@/lib/apply-preferences";

/** The saved "mark jobs as applied automatically" choice, shared by every consumer. */
export function useAutoMarkApplied() {
  const enabled = useSyncExternalStore(
    subscribeAutoMarkApplied,
    () => readAutoMarkApplied(),
    getAutoMarkAppliedServerSnapshot,
  );
  // A one-argument setter, so it is safe as an onChange that also passes an event.
  const setEnabled = (next: boolean) => writeAutoMarkApplied(next);
  return [enabled, setEnabled] as const;
}
