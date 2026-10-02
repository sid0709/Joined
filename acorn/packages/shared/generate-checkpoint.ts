/** Resume-generation checkpoint: which steps finished, their outputs, and where the run failed. */

export const GENERATE_STEPS = ["load-jd", "summary", "skills", "experience", "finalize"] as const;

export type GenerateStepId = (typeof GENERATE_STEPS)[number];

export const GENERATE_SECTION_STEPS = ["summary", "skills", "experience"] as const;
export type GenerateSectionStepId = (typeof GENERATE_SECTION_STEPS)[number];

export type GenerateCheckpointOutputs = {
  jobDescription: string | null;
  title: string | null;
  url: string | null;
  partialSections: Record<string, unknown> | null;
  inputId: string | null;
  generationId: string | null;
  resumeId: string | null;
};

export type GenerateCheckpoint = {
  completedSteps: GenerateStepId[];
  failedStep: GenerateStepId | null;
  error: string | null;
  outputs: GenerateCheckpointOutputs;
};

export type GenerateEnqueueCheckpoint = {
  completedSteps: GenerateStepId[];
  failedStep: GenerateStepId | null;
  resumeFrom: GenerateStepId | null;
  partialSections: Record<string, unknown> | null;
};

const STEP_SET = new Set<string>(GENERATE_STEPS);

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function isGenerateStepId(value: unknown): value is GenerateStepId {
  return typeof value === "string" && STEP_SET.has(value);
}

export function emptyGenerateCheckpoint(): GenerateCheckpoint {
  return {
    completedSteps: [],
    failedStep: null,
    error: null,
    outputs: {
      jobDescription: null,
      title: null,
      url: null,
      partialSections: null,
      inputId: null,
      generationId: null,
      resumeId: null,
    },
  };
}

export function normalizeGenerateCheckpoint(value: unknown): GenerateCheckpoint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Partial<GenerateCheckpoint> & {
    outputs?: Partial<GenerateCheckpointOutputs>;
  };
  const completedSteps = Array.isArray(row.completedSteps)
    ? row.completedSteps.filter(isGenerateStepId)
    : [];
  const outputs: Partial<GenerateCheckpointOutputs> =
    row.outputs && typeof row.outputs === "object" ? row.outputs : {};
  const partial = outputs.partialSections;
  return {
    completedSteps,
    failedStep: isGenerateStepId(row.failedStep) ? row.failedStep : null,
    error: typeof row.error === "string" && row.error.trim() ? row.error : null,
    outputs: {
      jobDescription: readOptionalText(outputs.jobDescription),
      title: readOptionalText(outputs.title),
      url: readOptionalText(outputs.url),
      partialSections:
        partial && typeof partial === "object" && !Array.isArray(partial)
          ? (partial as Record<string, unknown>)
          : null,
      inputId: readOptionalText(outputs.inputId),
      generationId: readOptionalText(outputs.generationId),
      resumeId: readOptionalText(outputs.resumeId),
    },
  };
}

function readOptionalText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

export function isStepDone(checkpoint: GenerateCheckpoint, step: GenerateStepId): boolean {
  return checkpoint.completedSteps.includes(step);
}

export function nextGenerateStep(checkpoint: GenerateCheckpoint): GenerateStepId | null {
  return GENERATE_STEPS.find((step) => !checkpoint.completedSteps.includes(step)) ?? null;
}

/** Any failed run can Continue; completed prior steps are reused when present. */
export function canContinueGenerate(
  status: string | null | undefined,
  checkpoint: GenerateCheckpoint | null | undefined,
): boolean {
  return status === "failed" && checkpoint != null;
}

export function markStepDone(
  checkpoint: GenerateCheckpoint,
  step: GenerateStepId,
): GenerateCheckpoint {
  if (checkpoint.completedSteps.includes(step)) {
    return {
      ...checkpoint,
      failedStep: checkpoint.failedStep === step ? null : checkpoint.failedStep,
      error: checkpoint.failedStep === step ? null : checkpoint.error,
    };
  }
  return {
    ...checkpoint,
    completedSteps: [...checkpoint.completedSteps, step],
    failedStep: checkpoint.failedStep === step ? null : checkpoint.failedStep,
    error: checkpoint.failedStep === step ? null : checkpoint.error,
  };
}

export function markGenerateFailed(
  checkpoint: GenerateCheckpoint,
  step: GenerateStepId,
  error: string,
): GenerateCheckpoint {
  return {
    ...checkpoint,
    failedStep: step,
    error: error.trim() || "Résumé generation failed",
  };
}

export function completedSectionsFromPartial(partial: unknown): GenerateSectionStepId[] {
  const record = asRecord(partial);
  return GENERATE_SECTION_STEPS.filter((step) => record[step] != null);
}

export function mergeSectionCompletions(
  checkpoint: GenerateCheckpoint,
  partial: unknown,
): GenerateCheckpoint {
  let next = checkpoint;
  if (partial && typeof partial === "object" && !Array.isArray(partial)) {
    next = {
      ...next,
      outputs: {
        ...next.outputs,
        partialSections: {
          ...(next.outputs.partialSections ?? {}),
          ...asRecord(partial),
        },
      },
    };
  }
  const sections = completedSectionsFromPartial(next.outputs.partialSections);
  if (sections.length > 0) next = markStepDone(next, "load-jd");
  for (const step of sections) {
    next = markStepDone(next, step);
  }
  return next;
}

export function toGenerateEnqueueCheckpoint(
  checkpoint: GenerateCheckpoint,
): GenerateEnqueueCheckpoint {
  return {
    completedSteps: checkpoint.completedSteps,
    failedStep: checkpoint.failedStep,
    resumeFrom: nextGenerateStep(checkpoint),
    partialSections: checkpoint.outputs.partialSections,
  };
}

export function sectionsRemaining(checkpoint: GenerateCheckpoint): boolean {
  return GENERATE_SECTION_STEPS.some((step) => !checkpoint.completedSteps.includes(step));
}

const GENERATE_STEP_LABEL: Record<GenerateStepId, string> = {
  "load-jd": "job description",
  summary: "summary",
  skills: "skills",
  experience: "experience",
  finalize: "save",
};

/** Card/toast copy for a failed Generate or Recommend run. */
export function formatGenerateFailure(input: {
  status?: string | null;
  workKind?: "generate" | "recommend" | null;
  error?: string | null;
  checkpoint?: GenerateCheckpoint | null;
}): string | null {
  const step = input.checkpoint?.failedStep ?? null;
  const reason = (input.checkpoint?.error || input.error || "").trim();
  if (input.status !== "failed" && !step && !reason) return null;

  const where =
    input.workKind === "recommend"
      ? step === "load-jd" || !step
        ? "job description"
        : "recommend"
      : step
        ? GENERATE_STEP_LABEL[step]
        : null;
  const kind =
    input.workKind === "recommend"
      ? "Recommend"
      : input.workKind === "generate"
        ? "Generate"
        : null;
  const head = where
    ? `${kind ? `${kind} failed at ${where}` : `Failed at ${where}`}`
    : kind
      ? `${kind} failed`
      : "Failed";
  return reason ? `${head}: ${reason}` : head;
}
