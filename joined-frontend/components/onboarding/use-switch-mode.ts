"use client";

import { useRouter } from "next/navigation";
import type { WorkspaceMode } from "@/lib/routes";
import { MODE_HOME, writeStoredWorkspaceMode } from "@/lib/workspace-preference";

/** Remember the mode, then land on its home. The same move for the picker and both account menus. */
export function useSwitchMode() {
  const router = useRouter();
  return (mode: WorkspaceMode) => {
    writeStoredWorkspaceMode(mode);
    router.push(MODE_HOME[mode]);
  };
}
