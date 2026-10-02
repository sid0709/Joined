import { labelLooksLikeResume } from "./resume-field";
import type { PlanAction, RuntimeAttachedFile } from "./types";

export type PlanStepFiles = {
  runtimeFile: RuntimeAttachedFile | null;
  /** Library resume from Job Search Recommend / Worker Pool. */
  recommendedResume: RuntimeAttachedFile | null;
  /** Custom-tab editor-generated résumé. */
  customResume: RuntimeAttachedFile | null;
  resumeFileKind?: "library" | "custom";
};

const RECOMMENDED_FILE_KEYS = new Set(["recommended_resume"]);
const CUSTOM_FILE_KEYS = new Set(["custom_resume"]);

export function isCustomResumeFile(
  file: Pick<RuntimeAttachedFile, "key"> | null | undefined,
): boolean {
  return CUSTOM_FILE_KEYS.has(
    String(file?.key || "")
      .trim()
      .toLowerCase(),
  );
}

export function isExecutableStep(action: PlanAction["action"]): boolean {
  return (
    action === "fill" ||
    action === "upload" ||
    action === "resume_upload" ||
    action === "select_radio" ||
    action === "wait" ||
    action === "validate"
  );
}

/** Resume/CV and other file inputs — not fill/select/wait. */
export function isFileUploadAction(action: Pick<PlanAction, "action">): boolean {
  return action.action === "upload" || action.action === "resume_upload";
}

/**
 * Run file uploads first (original relative order), then every other step
 * in the AI's original order. Host pages often parse a resume and reset
 * fields; fills after a completed upload survive that reset.
 */
export function executionIndexOrder(actions: PlanAction[]): number[] {
  const uploads: number[] = [];
  const rest: number[] = [];
  for (let i = 0; i < actions.length; i += 1) {
    if (isFileUploadAction(actions[i])) uploads.push(i);
    else rest.push(i);
  }
  return [...uploads, ...rest];
}

export function wantsRecommendedResume(action: PlanAction): boolean {
  if (action.action === "resume_upload") return true;
  if (action.action !== "upload") return false;
  const key = String(action.file || "")
    .trim()
    .toLowerCase();
  if (RECOMMENDED_FILE_KEYS.has(key) || CUSTOM_FILE_KEYS.has(key)) {
    return true;
  }
  return labelLooksLikeResume(action.expected_label);
}

export function resolveResumeUploadFile(files: PlanStepFiles): RuntimeAttachedFile | null {
  if (files.resumeFileKind === "custom") return files.customResume;
  if (files.resumeFileKind === "library") return files.recommendedResume;
  return files.customResume || files.recommendedResume;
}

export function resolveStepFile(
  action: PlanAction,
  files: PlanStepFiles,
): RuntimeAttachedFile | null {
  if (wantsRecommendedResume(action)) return resolveResumeUploadFile(files);
  if (action.action === "upload") return files.runtimeFile;
  return null;
}

export function resumeFileLabel(file: RuntimeAttachedFile | null): string {
  if (!file) return "";
  const stack = String(file.label || "").trim();
  if (stack && stack !== file.name) return `${stack} (${file.name})`;
  return file.name;
}

export function missingUploadReason(action: PlanAction, files: PlanStepFiles): string | null {
  if (action.action !== "upload" && action.action !== "resume_upload") {
    return null;
  }
  if (resolveStepFile(action, files)) return null;
  if (wantsRecommendedResume(action)) {
    return files.resumeFileKind === "custom"
      ? "Resume upload requires the generated résumé for this tab"
      : "Resume upload requires the Library resume recommended for this job";
  }
  return "Upload requires FILE_PATH runtime file, but none was loaded";
}
