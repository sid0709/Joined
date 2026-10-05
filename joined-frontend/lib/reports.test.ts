import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  JOB_REPORT_REASONS,
  REPORT_IDEMPOTENCY_HEADER,
  REPORT_IDEMPOTENCY_REUSED,
  REPORTS_PATH,
  fileJobReport,
  isIdempotencyReuse,
  isJobReportReason,
  jobReportReasonValues,
  newReportIdempotencyKey,
} from "@/lib/reports";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("job report reasons", () => {
  test("offers objective job codes and never not a good fit", () => {
    const values = jobReportReasonValues();
    expect(values).toEqual(["scam_job", "fake_company", "payment_request", "other_with_evidence"]);
    expect(values).not.toContain("not_a_good_fit");
    expect(values).not.toContain("no_show");
    expect(values).not.toContain("identity_mismatch");
    expect(JOB_REPORT_REASONS.every((item) => isJobReportReason(item.value))).toBe(true);
    expect(isJobReportReason("not_a_good_fit")).toBe(false);
  });

  test("posts a job report with a fresh idempotency key", async () => {
    const seen: { url: string; method: string; key: string; body: unknown } = {
      url: "",
      method: "",
      key: "",
      body: null,
    };
    globalThis.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      seen.url = String(input);
      seen.method = init?.method ?? "GET";
      seen.key = headers.get(REPORT_IDEMPOTENCY_HEADER) ?? "";
      seen.body = JSON.parse(String(init?.body));
      return Promise.resolve(new Response("{}", { status: 201 }));
    }) as unknown as typeof fetch;

    const key = newReportIdempotencyKey();
    await fileJobReport({
      jobId: "job-1",
      reasonCode: "scam_job",
      details: "  asks for a fee  ",
      idempotencyKey: key,
    });

    expect(seen).toEqual({
      url: REPORTS_PATH,
      method: "POST",
      key,
      body: {
        subjectType: "job",
        subjectId: "job-1",
        reasonCode: "scam_job",
        details: "asks for a fee",
        evidenceKeys: [],
      },
    });
    expect(key.length).toBeGreaterThan(0);
    expect(newReportIdempotencyKey()).not.toBe(key);
  });

  test("surfaces a reused idempotency key", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            code: REPORT_IDEMPOTENCY_REUSED,
            detail: "This report was already filed.",
          }),
          { status: 409 },
        ),
      ),
    ) as unknown as typeof fetch;

    const error = await fileJobReport({
      jobId: "job-1",
      reasonCode: "fake_company",
      details: "",
      idempotencyKey: "report-key-1",
    }).catch((cause: unknown) => cause);

    expect(isIdempotencyReuse(error)).toBe(true);
  });
});
