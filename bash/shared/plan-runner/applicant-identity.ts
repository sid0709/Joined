/** Linguistic applicant-identity rules — not vendor or employer names. */

const AI_TOOL_QUESTION_RE =
  /\b(ai|artificial intelligence|automated employment|automated decision|automated screening|automated assessment|automated hiring)\b/i;

const YES_LIKE_RE = /^(yes|y|true|i consent|i agree|agree|consent|i do consent)$/i;

export function looksLikeAiToolQuestion(label: string | null | undefined): boolean {
  return AI_TOOL_QUESTION_RE.test(String(label || ""));
}

/**
 * The applicant is a human. Never consent to AI / automated employment
 * decision / automated screening tools, and never claim they used those tools.
 */
export function rewriteApplicantIdentityValue(
  label: string | null | undefined,
  value: string | null | undefined,
): string | null | undefined {
  if (value == null || !looksLikeAiToolQuestion(label)) return value;
  const trimmed = String(value).trim();
  if (!trimmed) return value;
  if (YES_LIKE_RE.test(trimmed) || /^(i\s+)?(consent|agree)\b/i.test(trimmed)) {
    return "No";
  }
  return value;
}

export function applyApplicantIdentityToActions<
  T extends { expected_label?: string | null; value?: string | null },
>(actions: T[] | null | undefined): T[] {
  if (!actions?.length) return actions ?? [];
  for (const action of actions) {
    const next = rewriteApplicantIdentityValue(action.expected_label, action.value);
    if (next !== action.value) action.value = next ?? null;
  }
  return actions;
}
