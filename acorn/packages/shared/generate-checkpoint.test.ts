import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canContinueGenerate,
  emptyGenerateCheckpoint,
  markGenerateFailed,
  markStepDone,
  mergeSectionCompletions,
  nextGenerateStep,
  toGenerateEnqueueCheckpoint,
} from "./generate-checkpoint.ts";

describe("generate checkpoint", () => {
  it("starts at load-jd and Continue is available after any failed run", () => {
    const empty = emptyGenerateCheckpoint();
    assert.equal(nextGenerateStep(empty), "load-jd");
    assert.equal(canContinueGenerate("failed", empty), true);
    assert.equal(canContinueGenerate("running", empty), false);
  });

  it("Continue after steps 1–3 skips those steps and resumes at experience", () => {
    let checkpoint = emptyGenerateCheckpoint();
    checkpoint = markStepDone(checkpoint, "load-jd");
    checkpoint = mergeSectionCompletions(checkpoint, {
      summary: { text: "ok" },
      skills: { text: "ok" },
    });
    checkpoint = markGenerateFailed(checkpoint, "experience", "model timeout");

    assert.deepEqual(checkpoint.completedSteps, ["load-jd", "summary", "skills"]);
    assert.equal(nextGenerateStep(checkpoint), "experience");
    assert.equal(canContinueGenerate("failed", checkpoint), true);

    const payload = toGenerateEnqueueCheckpoint(checkpoint);
    assert.equal(payload.resumeFrom, "experience");
    assert.equal(payload.partialSections?.summary != null, true);
    assert.equal(payload.partialSections?.skills != null, true);
    assert.equal(payload.partialSections?.experience == null, true);
  });

  it("finalize is the last step after all sections exist", () => {
    let checkpoint = emptyGenerateCheckpoint();
    checkpoint = mergeSectionCompletions(checkpoint, {
      summary: {},
      skills: {},
      experience: {},
    });
    assert.equal(nextGenerateStep(checkpoint), "finalize");
  });
});
