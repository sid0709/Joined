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
  return [enabled, writeAutoMarkApplied] as const;
}
