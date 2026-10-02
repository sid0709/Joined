import type { RunStepRecord, RuntimeAttachedFile } from "@acorn/shared/plan-runner/types";
import type { PipelineProgress } from "@acorn/shared/pipeline-types";

export function buildResumeUploadProgress(args: {
  recommendedResume: RuntimeAttachedFile | null;
  resumeStack: string | null;
  skipReason?: string | null;
  steps?: RunStepRecord[];
}): NonNullable<PipelineProgress["resumeUpload"]> {
  const stack = String(args.recommendedResume?.label || args.resumeStack || "").trim() || null;
  const fileName = args.recommendedResume?.name || null;
  const resumeId = args.recommendedResume?.resumeId || null;
  const step = args.steps?.find((s) => s.action === "resume_upload");

  if (step?.status === "ok") {
    return { status: "uploaded", stack, fileName, resumeId };
  }
  if (step?.status === "skipped" || (args.steps?.length && !step)) {
    return {
      status: "skipped",
      stack,
      fileName: args.recommendedResume ? fileName : null,
      resumeId: args.recommendedResume ? resumeId : null,
      reason: args.skipReason || step?.message || null,
    };
  }
  if (args.recommendedResume) {
    return { status: "ready", stack, fileName, resumeId };
  }
  return {
    status: "skipped",
    stack,
    fileName: null,
    resumeId: null,
    reason: args.skipReason || null,
  };
}
