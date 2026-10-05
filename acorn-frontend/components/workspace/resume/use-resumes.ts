"use client";

import { SAMPLE_HISTORY, SAMPLE_LIBRARY } from "@/lib/workspace/resume-samples";
import { useWorkspace } from "../use-workspace";

/** Generated drafts (History) and uploaded files (Library), with samples until you add your own. */
export function useResumes() {
  const { workspace, update } = useWorkspace();
  const isSampleHistory = workspace.resumes.length === 0;
  const isSampleLibrary = workspace.library.length === 0;
  return {
    workspace,
    update,
    history: isSampleHistory ? SAMPLE_HISTORY : workspace.resumes,
    library: isSampleLibrary ? SAMPLE_LIBRARY : workspace.library,
    isSampleHistory,
    isSampleLibrary,
  };
}
