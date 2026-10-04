import type { PlanStepPayload, PlanStepResult } from "../types";
import { rewriteApplicantIdentityValue } from "@acorn/shared/plan-runner/applicant-identity";
import { isCustomResumeFile } from "@acorn/shared/plan-runner/step-file";
import { controlAlreadyMatches } from "./agents/already-filled";
import { fillElement } from "./agents/fill";
import { readControlValue } from "./agents/read-control-value";
import { resumeUpload } from "./agents/resume-upload";
import { selectRadioElement } from "./agents/select-radio";
import { uploadFileToElement } from "./agents/upload";
import { validateElementIndexes } from "./agents/validate";
import { waitMs } from "./agents/wait";
import { highlightElement } from "./highlighter";
import { verifyElementByPlan } from "./verify-element";
import { relocateElementByPlan } from "./verify/relocate";

function nearbyQuestionText(el: Element, expectedLabel: string | null): string {
  const bits = [expectedLabel || ""];
  const html = el as HTMLElement;
  bits.push(html.getAttribute("aria-label") || "");
  let node: Element | null = el;
  for (let i = 0; i < 8 && node; i += 1) {
    bits.push(node.getAttribute("aria-label") || "");
    const heading = node.querySelector(
      ":scope > label, :scope > legend, :scope > h1, :scope > h2, :scope > h3, :scope > h4",
    );
    if (heading?.textContent) bits.push(heading.textContent);
    const prev = node.previousElementSibling as HTMLElement | null;
    if (prev) bits.push(prev.innerText || prev.textContent || "");
    node = node.parentElement;
  }
  return bits.join(" ");
}

export async function runPlanStep(step: PlanStepPayload): Promise<PlanStepResult> {
  if (step.action === "wait") {
    const ms = await waitMs(step.ms);
    return { ok: true, verified: true, acted: true, details: { valueAfter: `${ms}ms` } };
  }

  if (step.action === "validate") {
    const indexes = step.element_indexes ?? [];
    if (!indexes.length) {
      return {
        ok: false,
        verified: false,
        acted: false,
        error: "validate requires element_indexes",
      };
    }
    const result = validateElementIndexes(indexes);
    return {
      ok: result.ok,
      verified: result.ok,
      acted: true,
      error: result.error,
      details: {
        valueAfter: result.results
          .filter((r) => r.ok)
          .map((r) => `${r.nodeId}=${r.valueAfter ?? ""}`)
          .join(", "),
      },
    };
  }

  if (step.element_index == null) {
    if (step.action === "resume_upload" && step.file?.base64) {
      const root = document.body || document.documentElement;
      if (!root) {
        return {
          ok: false,
          verified: false,
          acted: false,
          error: `${step.action} requires element_index`,
        };
      }
      try {
        const valueAfter = await resumeUpload(root, step.file, step.expected_label);
        return {
          ok: true,
          verified: true,
          acted: true,
          details: { valueAfter },
        };
      } catch (err) {
        return {
          ok: false,
          verified: true,
          acted: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
    return {
      ok: false,
      verified: false,
      acted: false,
      error: `${step.action} requires element_index`,
    };
  }

  let verified = verifyElementByPlan(step.element_index, step.expected_label, step.expected_role);

  if (!verified.ok || !verified.element) {
    const fallback = relocateElementByPlan(step.expected_label, step.expected_role, step.value);
    if (fallback.ok && fallback.element) {
      verified = fallback;
    } else {
      return {
        ok: false,
        verified: false,
        acted: false,
        error: verified.error || "Verification failed",
        details: {
          nodeId: step.element_index,
          matchedLabel: verified.matchedLabel,
          matchedRole: verified.matchedRole,
        },
      };
    }
  }

  const el = verified.element;
  if (!el) {
    return {
      ok: false,
      verified: false,
      acted: false,
      error: verified.error || "Verification failed",
    };
  }

  highlightElement(el);

  const questionText = nearbyQuestionText(
    el,
    [step.expected_label, verified.matchedLabel].filter(Boolean).join(" "),
  );
  let intended = step.value;
  const identityValue = rewriteApplicantIdentityValue(questionText, intended);
  if (identityValue !== intended) {
    intended = identityValue ?? null;
  }

  if (step.action === "verify_only") {
    return {
      ok: true,
      verified: true,
      acted: false,
      details: {
        nodeId: step.element_index,
        matchedLabel: verified.matchedLabel,
        matchedRole: verified.matchedRole,
      },
    };
  }

  // Resume / browser autofill may already populate the control — don't overwrite
  // when the live value already matches the planned answer.
  if (
    step.action === "fill" ||
    step.action === "select_radio" ||
    step.action === "upload" ||
    step.action === "resume_upload"
  ) {
    const prior = controlAlreadyMatches(el, intended, {
      fileName: step.file?.name ?? null,
    });
    if (prior.matched) {
      return {
        ok: true,
        verified: true,
        acted: false,
        alreadyFilled: true,
        details: {
          nodeId: step.element_index,
          matchedLabel: verified.matchedLabel,
          matchedRole: verified.matchedRole,
          valueAfter: prior.current,
        },
      };
    }
  }

  try {
    let valueAfter: string | undefined;

    switch (step.action) {
      case "fill": {
        if (intended == null || intended === "") {
          throw new Error("fill requires value");
        }
        valueAfter = await fillElement(el, intended, step.expected_label);
        break;
      }
      case "upload": {
        if (!step.file?.base64) {
          throw new Error("upload requires runtime file payload");
        }
        valueAfter = await uploadFileToElement(el, step.file);
        break;
      }
      case "resume_upload": {
        if (!step.file?.base64) {
          throw new Error(
            isCustomResumeFile(step.file)
              ? "resume_upload requires the generated résumé"
              : "resume_upload requires the recommended Library resume",
          );
        }
        valueAfter = await resumeUpload(el, step.file, step.expected_label);
        break;
      }
      case "select_radio": {
        valueAfter = await selectRadioElement(el, intended);
        break;
      }
      default:
        throw new Error(`Unsupported plan step action: ${step.action}`);
    }

    const after = valueAfter ?? readControlValue(el);
    return {
      ok: true,
      verified: true,
      acted: true,
      details: {
        nodeId: step.element_index,
        matchedLabel: verified.matchedLabel,
        matchedRole: verified.matchedRole,
        valueAfter: after,
      },
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      verified: true,
      acted: false,
      error,
      details: {
        nodeId: step.element_index,
        matchedLabel: verified.matchedLabel,
        matchedRole: verified.matchedRole,
      },
    };
  }
}
