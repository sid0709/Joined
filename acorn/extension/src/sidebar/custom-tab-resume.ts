import { formatGenerateFailure } from "@acorn/shared/generate-checkpoint";
import { customTabHasResume, type AcornCustomTabBinding } from "../tab-custom-session";

const RESUME_GENERATED = "Resume generated";
const RESUME_EMPTY_GENERATE = "Not generated...";
const RESUME_EMPTY_RECOMMEND = "No resume assigned";

export function customTabResumeLine(
  tab: AcornCustomTabBinding,
  filling: boolean,
): { text: string; ready: boolean; failed: boolean } {
  const recommending = tab.resumeMode === "recommend";
  if (tab.generateStatus === "queued" || tab.generateStatus === "running") {
    return {
      text: tab.generateProgress?.label || (recommending ? "Recommending…" : "Generating…"),
      ready: false,
      failed: false,
    };
  }
  if (filling) return { text: "Filling…", ready: false, failed: false };
  if (customTabHasResume(tab)) {
    if (recommending) {
      return {
        text: tab.recommendedResumeStack || "Recommended",
        ready: true,
        failed: false,
      };
    }
    return { text: RESUME_GENERATED, ready: true, failed: false };
  }
  const failure = formatGenerateFailure({
    status: tab.generateStatus,
    workKind: tab.workKind,
    error: tab.generateError,
    checkpoint: tab.checkpoint,
  });
  if (failure) return { text: failure, ready: false, failed: true };
  return {
    text: recommending ? RESUME_EMPTY_RECOMMEND : RESUME_EMPTY_GENERATE,
    ready: false,
    failed: false,
  };
}

/** The page's host for display, or the raw URL when it doesn't parse. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url || "Unknown page";
  }
}
