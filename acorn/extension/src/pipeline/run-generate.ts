import {
  canContinueGenerate,
  emptyGenerateCheckpoint,
  formatGenerateFailure,
  markGenerateFailed,
  markStepDone,
  mergeSectionCompletions,
  nextGenerateStep,
  sectionsRemaining,
  toGenerateEnqueueCheckpoint,
  type GenerateCheckpoint,
} from "@acorn/shared/generate-checkpoint";
import type { CustomGenerateStatus, CustomWorkKind } from "../tab-custom-session";
import { broadcastOperatorNotice } from "../operator-notice";
import { fetchCustomResume } from "./api/custom-files";
import {
  continueCustomGenerate,
  enqueueCustomGenerate,
  pollCustomGenerate,
  type CustomGeneratePoll,
} from "./api/custom-generate";
import {
  customUiProgress,
  type CustomGeneratePhase,
  type CustomUiProgress,
} from "./custom-generate-progress";

const POLL_MS = 400;
const GENERATE_TIMEOUT_MS = 5 * 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ResumeGenerateSource = "fill" | "custom";

export type ResumeGeneratePatch = {
  workKind?: CustomWorkKind | null;
  resumeMode?: "generate" | "recommend";
  generateStatus?: CustomGenerateStatus;
  generateError?: string | null;
  generateProgress?: CustomUiProgress | null;
  checkpoint?: GenerateCheckpoint | null;
  jobDescription?: string | null;
  inputId?: string | null;
  generationId?: string | null;
  resumeId?: string | null;
};

export type ResumeGenerateStore = {
  patch: (partial: ResumeGeneratePatch) => Promise<void>;
  readCheckpoint: () => Promise<GenerateCheckpoint | null>;
  readStatus: () => Promise<CustomGenerateStatus | null>;
};

function phaseOf(checkpoint: GenerateCheckpoint): CustomGeneratePhase {
  const next = nextGenerateStep(checkpoint);
  if (next === "load-jd" || next == null) return "load-jd";
  if (next === "finalize") return "finalize";
  return "generate";
}

function progressFor(
  status: string,
  checkpoint: GenerateCheckpoint,
  source: ResumeGenerateSource,
  poll?: CustomGeneratePoll | null,
): CustomUiProgress {
  return customUiProgress({
    status,
    phase: phaseOf(checkpoint),
    source,
    partialSections: checkpoint.outputs.partialSections,
    progress: poll?.progress,
    checkpoint,
  });
}

export async function runResumeGenerate(args: {
  source: ResumeGenerateSource;
  apiUrl: string;
  continue?: boolean;
  jobId?: string | null;
  loadJd: () => Promise<{ jobDescription: string; title?: string; url?: string }>;
  store: ResumeGenerateStore;
}): Promise<void> {
  const { source, apiUrl, jobId, loadJd, store } = args;
  const existing = args.continue ? await store.readCheckpoint() : null;
  const resumable = args.continue && existing && canContinueGenerate("failed", existing);

  let checkpoint = resumable ? existing : emptyGenerateCheckpoint();
  if (resumable) {
    checkpoint = { ...checkpoint, failedStep: null, error: null };
  }

  const persist = async (
    status: CustomGenerateStatus,
    extra: ResumeGeneratePatch = {},
    poll?: CustomGeneratePoll | null,
  ) => {
    await store.patch({
      workKind: "generate",
      resumeMode: "generate",
      generateStatus: status,
      generateError: status === "failed" ? checkpoint.error : null,
      generateProgress:
        status === "completed" ? null : progressFor(status, checkpoint, source, poll),
      checkpoint,
      jobDescription: checkpoint.outputs.jobDescription,
      inputId: checkpoint.outputs.inputId,
      generationId: checkpoint.outputs.generationId,
      resumeId: checkpoint.outputs.resumeId,
      ...extra,
    });
  };

  const fail = async (step = nextGenerateStep(checkpoint) ?? "load-jd", error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    checkpoint = markGenerateFailed(checkpoint, step, message);
    await persist("failed");
    const detail = formatGenerateFailure({
      status: "failed",
      workKind: "generate",
      error: message,
      checkpoint,
    });
    broadcastOperatorNotice({
      kind: "error",
      title: source === "fill" ? "Fill generate failed" : "Generate failed",
      detail: detail || message,
    });
    throw error instanceof Error ? error : new Error(message);
  };

  await persist("queued");
  await persist("running");

  try {
    if (nextGenerateStep(checkpoint) === "load-jd") {
      const loaded = await loadJd();
      const jobDescription = loaded.jobDescription.trim();
      if (!jobDescription) {
        await fail("load-jd", new Error("No job description to generate from"));
        return;
      }
      checkpoint = {
        ...markStepDone(checkpoint, "load-jd"),
        outputs: {
          ...checkpoint.outputs,
          jobDescription,
          title: loaded.title?.trim() || checkpoint.outputs.title,
          url: loaded.url?.trim() || checkpoint.outputs.url,
        },
      };
      await persist("running");
    }

    if (sectionsRemaining(checkpoint)) {
      const jobDescription = checkpoint.outputs.jobDescription;
      if (!jobDescription) {
        await fail("load-jd", new Error("No job description to generate from"));
        return;
      }
      const enqueueCheckpoint = toGenerateEnqueueCheckpoint(checkpoint);
      const enqueue =
        resumable && checkpoint.outputs.inputId
          ? continueCustomGenerate(
              {
                inputId: checkpoint.outputs.inputId,
                jobDescription,
                jobId,
                checkpoint: enqueueCheckpoint,
              },
              apiUrl,
            )
          : enqueueCustomGenerate(
              {
                jobDescription,
                jobId,
                checkpoint: resumable ? enqueueCheckpoint : null,
              },
              apiUrl,
            );
      const { inputId } = await enqueue;
      checkpoint = {
        ...checkpoint,
        outputs: { ...checkpoint.outputs, inputId },
      };
      await persist("running");

      const startedAt = Date.now();
      while (Date.now() - startedAt < GENERATE_TIMEOUT_MS) {
        const poll = await pollCustomGenerate(inputId, apiUrl);
        checkpoint = mergeSectionCompletions(checkpoint, poll.partialSections);
        if (poll.generationId) {
          checkpoint = {
            ...checkpoint,
            outputs: {
              ...checkpoint.outputs,
              generationId: poll.generationId,
              resumeId: poll.resumeId || checkpoint.outputs.resumeId,
            },
          };
        }
        if (poll.status === "completed") {
          checkpoint = markStepDone(
            markStepDone(markStepDone(checkpoint, "summary"), "skills"),
            "experience",
          );
          if (!checkpoint.outputs.generationId) {
            await fail("finalize", new Error("Generate finished without a résumé id"));
            return;
          }
          await persist("running", {}, poll);
          break;
        }
        if (poll.status === "failed" || poll.status === "cancelled") {
          await fail(
            nextGenerateStep(checkpoint) ?? "experience",
            new Error(poll.error || "Résumé generation failed"),
          );
          return;
        }
        await persist("running", {}, poll);
        await sleep(POLL_MS);
      }
      if (sectionsRemaining(checkpoint) && !checkpoint.outputs.generationId) {
        await fail(
          nextGenerateStep(checkpoint) ?? "experience",
          new Error("Résumé generation timed out"),
        );
        return;
      }
    }

    if (nextGenerateStep(checkpoint) === "finalize") {
      const generationId = checkpoint.outputs.generationId;
      if (!generationId) {
        await fail("finalize", new Error("Generate finished without a résumé id"));
        return;
      }
      const file = await fetchCustomResume(generationId, apiUrl);
      if (!file?.base64) {
        await fail(
          "finalize",
          new Error("Generate finished without a stored editor résumé in Firestore"),
        );
        return;
      }
      checkpoint = {
        ...markStepDone(checkpoint, "finalize"),
        outputs: {
          ...checkpoint.outputs,
          resumeId: file.resumeId || checkpoint.outputs.resumeId,
        },
      };
    }

    await persist("completed", { generateProgress: null });
  } catch (err) {
    const status = await store.readStatus();
    if (status === "failed") throw err;
    await fail(nextGenerateStep(checkpoint) ?? "load-jd", err);
  }
}
