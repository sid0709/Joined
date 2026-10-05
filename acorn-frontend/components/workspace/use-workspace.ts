"use client";

import { useSyncExternalStore } from "react";
import {
  emptyWorkspace,
  readWorkspaceSnapshot,
  subscribeWorkspace,
  writeWorkspace,
  type Workspace,
} from "@/lib/workspace/model";

export function useWorkspace() {
  const workspace = useSyncExternalStore(subscribeWorkspace, readWorkspaceSnapshot, emptyWorkspace);
  const update = (next: Workspace) => {
    writeWorkspace(next);
  };
  return { workspace, update };
}
