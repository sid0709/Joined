import type { PipelineProgress } from "@acorn/shared/pipeline-types";

type ResumeUploadNoteProps = {
  progress: PipelineProgress;
  boundStack: string | null;
  hasBoundJob: boolean;
  kind?: "library" | "custom";
};

export function ResumeUploadNote({
  progress,
  boundStack,
  hasBoundJob,
  kind = "library",
}: ResumeUploadNoteProps) {
  const ru = progress.resumeUpload;
  let text: string;
  let tone: "idle" | "ready" | "uploaded" | "skipped" = "idle";

  if (ru?.status === "uploaded") {
    const label = [ru.stack, ru.fileName].filter(Boolean).join(" · ");
    text = `Uploaded ${label || "resume"}`;
    tone = "uploaded";
  } else if (ru?.status === "ready") {
    const label = [ru.stack, ru.fileName].filter(Boolean).join(" · ");
    text = `Will upload ${label || "resume"}`;
    tone = "ready";
  } else if (ru?.status === "skipped") {
    text =
      ru.reason ||
      (ru.stack && !ru.fileName
        ? `Could not load the ${ru.stack} file — skipped upload, filling other fields`
        : ru.stack
          ? `Skipped resume upload (${ru.stack}) — filling other fields`
          : "No generated or recommended resume — skipped upload, filling other fields");
    tone = "skipped";
  } else if (hasBoundJob && boundStack) {
    text = `This tab will upload: ${boundStack}`;
  } else if (kind === "custom" && hasBoundJob) {
    text = "Generate a résumé for this tab so Fill can upload it. Other fields still fill.";
    tone = "idle";
  } else if (hasBoundJob) {
    text = "This tab has no generated or recommended resume — Fill will skip resume upload";
    tone = "skipped";
  } else {
    text = "Pick a Worker pool job so Fill can upload its generated or recommended resume";
  }

  return <p className={`resume-upload-note ${tone}`}>{text}</p>;
}
