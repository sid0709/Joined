/** Seeker job-report reasons. Staff-only codes and "not a good fit" stay off this list. */
export const JOB_REPORT_REASONS = [
  { value: "scam_job", label: "Scam job" },
  { value: "fake_company", label: "Fake company" },
  { value: "payment_request", label: "Asks for payment" },
  { value: "other_with_evidence", label: "Something else, with details" },
] as const;

export type JobReportReason = (typeof JOB_REPORT_REASONS)[number]["value"];

export const REPORTS_PATH = "/api/reports";
export const REPORT_IDEMPOTENCY_HEADER = "Idempotency-Key";
export const REPORT_IDEMPOTENCY_REUSED = "idempotency_key_reused";
export const JOB_REPORT_SUBJECT = "job";

export function isJobReportReason(value: string): value is JobReportReason {
  return JOB_REPORT_REASONS.some((item) => item.value === value);
}

export function jobReportReasonValues(): string[] {
  return JOB_REPORT_REASONS.map((item) => item.value);
}

export function newReportIdempotencyKey(): string {
  return crypto.randomUUID();
}

export type JobReportInput = {
  jobId: string;
  reasonCode: JobReportReason;
  details: string;
  idempotencyKey: string;
};

export function jobReportBody(input: Pick<JobReportInput, "jobId" | "reasonCode" | "details">) {
  return {
    subjectType: JOB_REPORT_SUBJECT,
    subjectId: input.jobId,
    reasonCode: input.reasonCode,
    details: input.details.trim(),
    evidenceKeys: [] as string[],
  };
}

export class JobReportError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "JobReportError";
    this.status = status;
    this.code = code;
  }
}

export function isIdempotencyReuse(error: unknown): error is JobReportError {
  return error instanceof JobReportError && error.code === REPORT_IDEMPOTENCY_REUSED;
}

export async function fileJobReport(input: JobReportInput): Promise<void> {
  if (!isJobReportReason(input.reasonCode)) {
    throw new JobReportError("Use an objective job reason.", 422, "validation_failed");
  }
  const response = await fetch(REPORTS_PATH, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      [REPORT_IDEMPOTENCY_HEADER]: input.idempotencyKey,
    },
    body: JSON.stringify(jobReportBody(input)),
  });
  if (response.ok) return;
  const text = await response.text();
  let message = "Could not file the report.";
  let code: string | undefined;
  try {
    const body = JSON.parse(text) as { detail?: string; error?: string; code?: string };
    if (body.detail) message = body.detail;
    else if (body.error) message = body.error;
    if (body.code) code = body.code;
  } catch {
    /* keep the generic message */
  }
  throw new JobReportError(message, response.status, code);
}
