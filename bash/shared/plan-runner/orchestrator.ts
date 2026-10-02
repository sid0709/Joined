import { applyApplicantIdentityToActions } from "./applicant-identity";
import { collectForbiddenIndexes, targetsForbiddenIndex } from "./forbidden";
import { labelLooksLikeOtherDocument } from "./resume-field";
import {
  executionIndexOrder,
  isExecutableStep,
  missingUploadReason,
  resolveStepFile,
  resumeFileLabel,
  wantsRecommendedResume,
  type PlanStepFiles,
} from "./step-file";
import type {
  ActionPlan,
  PauseDecision,
  PauseRequest,
  PlanAction,
  PlanStepActionType,
  PlanStepPayload,
  PlanStepResult,
  RuntimeAttachedFile,
  RunReport,
  RunStepRecord,
} from "./types";

export interface OrchestratorHooks {
  onSteps: (steps: RunStepRecord[]) => void;
  onPause: (request: PauseRequest) => Promise<PauseDecision>;
}

export interface RunPlanOptions {
  plan: ActionPlan;
  /** Execute one plan step against the live page (socket or direct tab message). */
  executeStep: (step: PlanStepPayload) => Promise<PlanStepResult>;
  runtimeFile: RuntimeAttachedFile | null;
  /** Library resume assigned by Job Search Recommend / Worker Pool. */
  recommendedResume?: RuntimeAttachedFile | null;
  /** Custom-tab editor-generated résumé. */
  customResume?: RuntimeAttachedFile | null;
  resumeFileKind?: "library" | "custom";
  hooks: OrchestratorHooks;
}

function toStepPayload(action: PlanAction, files: PlanStepFiles): PlanStepPayload {
  return {
    action: action.action as PlanStepActionType,
    element_index: action.element_index,
    element_indexes: action.element_indexes,
    expected_label: action.expected_label,
    expected_role: action.expected_role,
    value: action.value,
    file: resolveStepFile(action, files),
    ms: action.ms,
  };
}

function summarize(steps: RunStepRecord[]): RunReport["summary"] {
  return {
    ok: steps.filter((s) => s.status === "ok").length,
    skipped: steps.filter((s) => s.status === "skipped").length,
    blocked: steps.filter((s) => s.status === "blocked").length,
    failed: steps.filter((s) => s.status === "failed").length,
    paused: steps.filter((s) => s.status === "paused").length,
  };
}

export async function runActionPlan(options: RunPlanOptions): Promise<RunReport> {
  const {
    plan,
    executeStep,
    runtimeFile,
    recommendedResume = null,
    customResume = null,
    resumeFileKind,
    hooks,
  } = options;
  const files: PlanStepFiles = {
    runtimeFile,
    recommendedResume,
    customResume,
    resumeFileKind,
  };
  applyApplicantIdentityToActions(plan.actions);
  const forbidden = collectForbiddenIndexes(plan);
  const stopBeforeSubmit = plan.validation?.stop_before_submit !== false;

  const steps: RunStepRecord[] = (plan.actions ?? []).map((action, index) => ({
    index,
    action: action.action,
    element_index: action.element_index,
    expected_label: action.expected_label,
    status: "pending",
  }));
  hooks.onSteps([...steps]);

  let aborted = false;

  const publish = () => hooks.onSteps([...steps]);

  const actions = plan.actions ?? [];
  const order = executionIndexOrder(actions);

  for (const i of order) {
    if (aborted) {
      steps[i].status = "aborted";
      publish();
      continue;
    }

    const action = actions[i];
    steps[i].status = "running";
    publish();

    if (action.action === "forbidden") {
      steps[i].status = "blocked";
      steps[i].message = action.reason || "Forbidden action marker";
      publish();
      continue;
    }

    if (
      stopBeforeSubmit &&
      targetsForbiddenIndex(action, forbidden) &&
      action.action !== "pause_for_review"
    ) {
      steps[i].status = "blocked";
      steps[i].message = "Blocked: targets a forbidden element index";
      publish();
      continue;
    }

    if (action.action === "pause_for_review") {
      steps[i].status = "paused";
      publish();

      const canAutofillPause =
        action.element_index != null &&
        typeof action.value === "string" &&
        action.value.trim().length > 0;

      const decision = await hooks.onPause({
        index: i,
        action: action.action,
        element_index: action.element_index,
        expected_label: action.expected_label,
        reason: action.reason || "Paused for human review",
        kind: "planned",
      });

      if (decision === "abort") {
        steps[i].status = "aborted";
        steps[i].message = "Aborted by user";
        aborted = true;
        publish();
        break;
      }
      if (decision === "skip") {
        steps[i].status = "skipped";
        steps[i].message = "Skipped by user";
        publish();
        continue;
      }

      if (canAutofillPause) {
        try {
          const result = await executeStep({
            action: "select_radio",
            element_index: action.element_index,
            element_indexes: null,
            expected_label: action.expected_label,
            expected_role: action.expected_role,
            value: action.value,
            file: null,
            ms: null,
          });
          if (result.ok) {
            steps[i].status = "ok";
            steps[i].message = result.details?.valueAfter
              ? `value=${result.details.valueAfter}`
              : "Reviewed — autofilled";
            publish();
            continue;
          }
          steps[i].status = "failed";
          steps[i].message = result.error || "Pause autofill failed";
          publish();
          continue;
        } catch (err) {
          steps[i].status = "failed";
          steps[i].message = err instanceof Error ? err.message : String(err);
          publish();
          continue;
        }
      }

      steps[i].status = "ok";
      steps[i].message = "Reviewed — continued";
      publish();
      continue;
    }

    if (!isExecutableStep(action.action)) {
      steps[i].status = "failed";
      steps[i].message = `Unsupported action: ${action.action}`;
      publish();
      continue;
    }

    if (action.action === "resume_upload" && labelLooksLikeOtherDocument(action.expected_label)) {
      steps[i].status = "skipped";
      steps[i].message =
        files.resumeFileKind === "custom"
          ? "Generated résumé is only for Resume/CV controls"
          : "Recommended resume is only for Resume/CV controls";
      publish();
      continue;
    }

    const missingFile = missingUploadReason(action, files);
    if (missingFile) {
      const decision = await hooks.onPause({
        index: i,
        action: action.action,
        element_index: action.element_index,
        expected_label: action.expected_label,
        reason: missingFile,
        kind: "error",
      });
      if (decision === "abort") {
        steps[i].status = "aborted";
        aborted = true;
        publish();
        break;
      }
      if (decision === "skip") {
        steps[i].status = "skipped";
        steps[i].message = wantsRecommendedResume(action)
          ? files.resumeFileKind === "custom"
            ? "Skipped — no generated résumé"
            : "Skipped — no recommended resume"
          : "Skipped missing upload file";
        publish();
        continue;
      }
    }

    let done = false;
    while (!done && !aborted) {
      try {
        if (missingFile) {
          throw new Error(missingFile);
        }

        const result = await executeStep(toStepPayload(action, files));

        if (result.ok) {
          if (result.alreadyFilled) {
            steps[i].status = "skipped";
            steps[i].message = result.details?.valueAfter
              ? `already=${result.details.valueAfter}`
              : "Already filled";
          } else {
            const uploaded = resumeFileLabel(resolveStepFile(action, files));
            steps[i].status = "ok";
            steps[i].message =
              wantsRecommendedResume(action) && uploaded
                ? `Uploaded ${uploaded}`
                : result.details?.valueAfter
                  ? `value=${result.details.valueAfter}`
                  : undefined;
          }
          publish();
          done = true;
          break;
        }

        steps[i].status = "paused";
        steps[i].message = result.error || "Step failed";
        publish();

        const decision = await hooks.onPause({
          index: i,
          action: action.action,
          element_index: action.element_index,
          expected_label: action.expected_label,
          reason: result.error || "Step failed verification or action",
          kind: "error",
        });

        if (decision === "abort") {
          steps[i].status = "aborted";
          steps[i].message = result.error || "Aborted";
          aborted = true;
          publish();
          done = true;
        } else if (decision === "skip") {
          steps[i].status = "skipped";
          steps[i].message = result.error || "Skipped after failure";
          publish();
          done = true;
        } else {
          steps[i].status = "running";
          steps[i].message = "Retrying...";
          publish();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        steps[i].status = "paused";
        steps[i].message = message;
        publish();

        const decision = await hooks.onPause({
          index: i,
          action: action.action,
          element_index: action.element_index,
          expected_label: action.expected_label,
          reason: message,
          kind: "error",
        });

        if (decision === "abort") {
          steps[i].status = "aborted";
          steps[i].message = message;
          aborted = true;
          publish();
          done = true;
        } else if (decision === "skip") {
          steps[i].status = "skipped";
          steps[i].message = message;
          publish();
          done = true;
        } else {
          steps[i].status = "running";
          steps[i].message = "Retrying...";
          publish();
        }
      }
    }
  }

  if (aborted) {
    for (const step of steps) {
      if (step.status === "pending" || step.status === "running") {
        step.status = "aborted";
      }
    }
    publish();
  }

  const summary = summarize(steps);
  return {
    ok: !aborted && summary.failed === 0,
    aborted,
    steps,
    summary,
  };
}
