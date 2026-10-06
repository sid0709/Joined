import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  FIT_ROLE_LABEL,
  FIT_TITLE_CRITERION,
  criterionLabel,
  fetchJobFits,
  parseJobFit,
  visibleFit,
  type JobFit,
} from "@/lib/jobs/fit";

const realFetch = globalThis.fetch;

function sampleFit(patch: Partial<JobFit> = {}): JobFit {
  return {
    jobId: "job-1",
    score: 82,
    reason: "Title matches your target role",
    confidence: "high",
    modelVersion: "fitscore-v1",
    criteria: [
      { id: FIT_TITLE_CRITERION, label: "Title", detail: "Matches staff engineer", level: "yes" },
    ],
    needsVisa: false,
    ...patch,
  };
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("fit score display", () => {
  test("hides the score for guests and omitted payloads", () => {
    expect(visibleFit(false, sampleFit())).toBeNull();
    expect(visibleFit(true, null)).toBeNull();
    expect(visibleFit(true, undefined)).toBeNull();
    expect(visibleFit(true, sampleFit({ score: 1.5 }))).toBeNull();
  });

  test("keeps a signed-in score and maps the title criterion to the role label", () => {
    const shown = visibleFit(true, sampleFit());
    expect(shown?.score).toBe(82);
    expect(shown?.reason).toBe("Title matches your target role");
    expect(criterionLabel({ id: FIT_TITLE_CRITERION, label: "Title" })).toBe("Title");
    expect(criterionLabel({ id: FIT_TITLE_CRITERION, label: "" })).toBe(FIT_ROLE_LABEL);
    expect(criterionLabel({ id: "skills", label: "Skills" })).toBe("Skills");
  });

  test("drops a payload that omits the score", () => {
    expect(parseJobFit({ jobId: "job-1", reason: "missing score" })).toBeNull();
    expect(parseJobFit({ jobId: "job-1", score: 40, reason: "ok" })?.score).toBe(40);
  });

  test("loads a batch and ignores rows without a job id", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            scores: [
              { jobId: "a", score: 70, reason: "Skills overlap", modelVersion: "fitscore-v1" },
              { score: 10, reason: "no id" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    ) as unknown as typeof fetch;
    const rows = await fetchJobFits(["a", "a", "b"]);
    expect(rows).toEqual([
      {
        jobId: "a",
        score: 70,
        reason: "Skills overlap",
        confidence: "",
        modelVersion: "fitscore-v1",
        criteria: [],
        needsVisa: false,
      },
    ]);
  });
});
