/** Form-field document type from label / input / section text. */

export type DocumentFieldKind = "resume" | "other" | "unknown";

const RESUME_RE = /\b(resume|cv|curriculum\s*vitae)\b/i;
const OTHER_DOC_RE =
  /\b(cover\s*letter|transcript|writing\s*sample|portfolio|certificate|diploma|offer\s*letter)\b/i;

export function documentFieldKind(text: string): DocumentFieldKind {
  const raw = String(text || "");
  const resume = RESUME_RE.test(raw);
  const other = OTHER_DOC_RE.test(raw);
  if (resume) return "resume";
  if (other) return "other";
  return "unknown";
}

export function labelLooksLikeResume(label: string | null | undefined): boolean {
  return documentFieldKind(label || "") === "resume";
}

export function labelLooksLikeOtherDocument(label: string | null | undefined): boolean {
  return documentFieldKind(label || "") === "other";
}
