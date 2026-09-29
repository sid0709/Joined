/**
 * Layer B — Intake & CRM (first slice) shapes.
 *
 * Einstein contract (persist + return these fields; frontend already sends/reads them):
 *
 * POST/PUT /v1/company/jobs
 *   body.screeningQuestions?: ScreeningQuestion[]
 *   response includes screeningQuestions on CompanyJob
 *
 * GET /v1/search/jobs/:id (and list cards when cheap)
 *   Job.screeningQuestions?: ScreeningQuestion[]
 *
 * POST /v1/me/applications
 *   body.screeningAnswers?: ScreeningAnswer[]
 *   body.referralSource?: string
 *   body.consentAt?: string (ISO-8601)
 *   body.consentVersion?: string
 *   Reject when a required screening answer is missing, or when consentAt is absent.
 *
 * GET /v1/company/applicants
 *   Applicant.screeningAnswers?: ScreeningAnswer[]
 *   Applicant.tags?: string[]
 *   Applicant.referralSource?: string
 *   Applicant.consentAt?: string
 *   Applicant.consentVersion?: string
 *   Applicant.userId?: string (opaque; enables reliable dupe detection)
 *
 * PATCH /v1/company/applicants/:id
 *   body.tags?: string[]  (in addition to columnId / notes / rating)
 */

export type ScreeningQuestionKind = "yes_no" | "short_text";

export type ScreeningQuestion = {
  id: string;
  prompt: string;
  kind: ScreeningQuestionKind;
  required: boolean;
  /** For yes_no: "yes" | "no". Matching answer marks knockedOut on the application. */
  knockoutAnswer?: string;
};

export type ScreeningAnswer = {
  questionId: string;
  prompt: string;
  value: string;
  knockedOut?: boolean;
};

/** Consent copy version stamped on apply. Bump when legal text changes. */
export const APPLY_CONSENT_VERSION = "opened-apply-v1";

export const APPLY_CONSENT_LABEL =
  "I confirm the information I submit is accurate, and I consent to this company processing my application materials for hiring.";

export const REFERRAL_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Prefer not to say" },
  { value: "openseat", label: "OpenSeat search" },
  { value: "employee", label: "Employee referral" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "agency", label: "Agency / scout" },
  { value: "other", label: "Other" },
];

export const TAG_SUGGESTIONS = [
  "Strong fit",
  "Referral",
  "Campus",
  "Warm lead",
  "Hold",
  "Diversity slate",
  "Rehire",
];

export const MAX_SCREENING_QUESTIONS = 8;
export const MAX_TAGS = 12;
export const MAX_ANSWER_LENGTH = 280;

export function newScreeningQuestion(partial?: Partial<ScreeningQuestion>): ScreeningQuestion {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `sq-${crypto.randomUUID()}`
      : `sq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    prompt: "",
    kind: "yes_no",
    required: true,
    knockoutAnswer: "no",
    ...partial,
  };
}

export function evaluateAnswer(question: ScreeningQuestion, value: string): ScreeningAnswer {
  const trimmed = value.trim();
  const knockedOut = Boolean(
    question.knockoutAnswer && trimmed.toLowerCase() === question.knockoutAnswer.toLowerCase(),
  );
  return {
    questionId: question.id,
    prompt: question.prompt,
    value: trimmed.slice(0, MAX_ANSWER_LENGTH),
    knockedOut: knockedOut || undefined,
  };
}

export function normalizePersonKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Same display name on another job — soft dupe until Einstein returns userId. */
export function findDuplicateApplicants<
  T extends { id: string; name: string; jobId: string; jobTitle: string },
>(applicant: T, all: T[]): T[] {
  const key = normalizePersonKey(applicant.name);
  if (!key) return [];
  return all.filter(
    (other) =>
      other.id !== applicant.id &&
      other.jobId !== applicant.jobId &&
      normalizePersonKey(other.name) === key,
  );
}

export function hydrateScreeningQuestions(
  raw: ScreeningQuestion[] | undefined | null,
): ScreeningQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item.prompt === "string")
    .map((item) => ({
      id: item.id || newScreeningQuestion().id,
      prompt: item.prompt.trim(),
      kind: (item.kind === "short_text" ? "short_text" : "yes_no") as ScreeningQuestionKind,
      required: item.required !== false,
      knockoutAnswer: item.knockoutAnswer?.trim() || undefined,
    }))
    .filter((item) => item.prompt.length > 0)
    .slice(0, MAX_SCREENING_QUESTIONS);
}

export function hydrateScreeningAnswers(
  raw: ScreeningAnswer[] | undefined | null,
): ScreeningAnswer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item.questionId === "string")
    .map((item) => ({
      questionId: item.questionId,
      prompt: item.prompt ?? "",
      value: String(item.value ?? "").slice(0, MAX_ANSWER_LENGTH),
      knockedOut: item.knockedOut || undefined,
    }));
}

export function hydrateTags(raw: string[] | undefined | null): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((tag) => tag.trim()).filter(Boolean))].slice(0, MAX_TAGS);
}
