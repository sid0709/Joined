import type { FieldError } from "./types";

/** An RFC 9457 problem the scout API answered with (docs/60-api-conventions.md). */
export type Problem = {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  detail?: string;
  errors?: FieldError[];
  existing_id?: string;
  /** Older endpoints answer `{ "error": "..." }`. */
  error?: string;
};

const FALLBACK = "Something went wrong. Try again.";

/** A failed API call, carrying the problem's code and field errors. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: FieldError[];
  readonly existingId?: string;

  constructor(status: number, problem: Problem | null) {
    super(problemMessage(problem));
    this.name = "ApiError";
    this.status = status;
    this.code = problem?.code ?? "";
    this.fields = problem?.errors ?? [];
    this.existingId = problem?.existing_id;
  }

  /** The message for one field, when the API rejected it. */
  field(name: string) {
    return this.fields.find((item) => item.field === name)?.detail;
  }
}

/** The most useful sentence in a problem body. */
export function problemMessage(problem: Problem | null | undefined) {
  if (!problem) return FALLBACK;
  if (problem.errors?.length) {
    return problem.errors
      .map((item) => `${item.field.replace(/_/g, " ")}: ${item.detail}`)
      .join("; ");
  }
  return problem.detail || problem.error || problem.title || FALLBACK;
}

/** Parses a JSON problem body, tolerating empty or non-JSON responses. */
export function parseProblem(text: string): Problem | null {
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null ? value : null;
  } catch {
    return null;
  }
}
