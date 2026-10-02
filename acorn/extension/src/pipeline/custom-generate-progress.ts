import {
  GENERATE_SECTION_STEPS,
  GENERATE_STEPS,
  isStepDone,
  type GenerateCheckpoint,
  type GenerateStepId,
} from "@acorn/shared/generate-checkpoint";

export type GenerateSegment = "done" | "active" | "pending" | "failed";

export type CustomUiProgress = {
  percent: number;
  label: string;
  segments: GenerateSegment[];
};

export type CustomGeneratePhase = "load-jd" | "generate" | "finalize";

const SECTION_SEGMENTS = GENERATE_SECTION_STEPS;
export const EXTRACT_LABEL = "Finding job description…";
export const LOAD_JD_LABEL = "Loading job description…";
export const FINALIZE_LABEL = "Saving résumé…";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function segmentFor(
  step: GenerateStepId,
  input: {
    status: string;
    phase?: CustomGeneratePhase;
    checkpoint?: GenerateCheckpoint | null;
    sections: Record<string, unknown>;
  },
): GenerateSegment {
  const checkpoint = input.checkpoint;
  if (checkpoint?.failedStep === step && input.status === "failed") return "failed";
  if (checkpoint && isStepDone(checkpoint, step)) return "done";
  if (step === "load-jd") {
    if (input.phase === "load-jd" || (input.phase == null && input.status === "queued")) {
      return input.status === "queued" || input.status === "running" ? "active" : "pending";
    }
    return input.phase ? "done" : "pending";
  }
  if (step === "finalize") {
    if (input.status === "completed") return "done";
    if (input.phase === "finalize" && (input.status === "queued" || input.status === "running")) {
      return "active";
    }
    return "pending";
  }
  if (input.status === "completed" || input.sections[step] != null) return "done";
  if (input.phase === "load-jd" || (input.phase == null && input.status === "queued")) {
    return "pending";
  }
  if (input.status === "queued" || input.status === "running") return "active";
  return "pending";
}

export function jdProgressLabel(source: "fill" | "custom" = "custom"): string {
  return source === "fill" ? LOAD_JD_LABEL : EXTRACT_LABEL;
}

export function customUiProgress(input: {
  status: string;
  phase?: CustomGeneratePhase;
  source?: "fill" | "custom";
  partialSections?: unknown;
  progress?: unknown;
  checkpoint?: GenerateCheckpoint | null;
}): CustomUiProgress {
  const extracting =
    input.phase === "load-jd" || (input.phase == null && input.status === "queued");
  const sections = asRecord(input.checkpoint?.outputs.partialSections ?? input.partialSections);
  const live = asRecord(input.progress);
  const completedSteps = Number(live.completedSteps || 0);
  const total = Number(live.total || 0);
  const running = input.status === "queued" || input.status === "running";
  const source = input.source ?? "custom";

  const segments: GenerateSegment[] = GENERATE_STEPS.map((step) =>
    segmentFor(step, {
      status: input.status,
      phase: input.phase,
      checkpoint: input.checkpoint,
      sections,
    }),
  );

  let percent = 0;
  if (input.status === "completed") percent = 100;
  else if (extracting) percent = 8;
  else if (input.phase === "finalize") percent = 92;
  else if (total > 0) {
    percent = Math.min(90, 8 + Math.round((completedSteps / total) * 80));
  } else if (running || input.status === "failed") {
    const done = SECTION_SEGMENTS.filter((purpose) => sections[purpose] != null).length;
    percent = Math.min(
      88,
      8 + Math.round(((done + (running ? 0.15 : 0)) / SECTION_SEGMENTS.length) * 80),
    );
  }

  const name = String(live.name || "").trim();
  const failedLabel =
    input.status === "failed" ? input.checkpoint?.error || "Generate failed" : null;
  const label = extracting
    ? jdProgressLabel(source)
    : input.phase === "finalize"
      ? FINALIZE_LABEL
      : failedLabel || name || (input.status === "queued" ? "Queued…" : "Generating…");

  return { percent, label, segments };
}
