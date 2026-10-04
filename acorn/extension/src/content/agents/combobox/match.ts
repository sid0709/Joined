import { askAiMatchOption } from "../match-option-client";
import { stripChoiceMarker } from "../string-similarity";
import { normalize, optionText } from "./options-dom";

function findLocalMatch(
  options: HTMLElement[],
  value: string,
  _fieldLabel?: string | null,
): { match: HTMLElement | null; score: number | null; strategy: string } {
  return matchLocally(options, value);
}

function matchLocally(
  options: HTMLElement[],
  value: string,
): { match: HTMLElement | null; score: number | null; strategy: string } {
  const target = normalize(value);
  const targetBare = normalize(stripChoiceMarker(value));
  if (!target) return { match: null, score: null, strategy: "empty" };

  const exact = options.find((opt) => {
    const have = normalize(optionText(opt));
    const haveBare = normalize(stripChoiceMarker(optionText(opt)));
    return have === target || haveBare === targetBare;
  });
  if (exact) return { match: exact, score: 1, strategy: "exact" };
  return { match: null, score: null, strategy: "none" };
}

function optionKey(text: string): string {
  return normalize(stripChoiceMarker(text))
    .replace(/[^\p{L}\p{N}+]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveOptionElement(options: HTMLElement[], label: string): HTMLElement | null {
  const want = optionKey(label);
  return (
    options.find((opt) => optionText(opt) === label) ||
    options.find((opt) => normalize(optionText(opt)) === normalize(label)) ||
    (want ? options.find((opt) => optionKey(optionText(opt)) === want) || null : null)
  );
}

/**
 * Closed lists already show every choice, so AI may pick a semantic equivalent.
 * Typeahead first pages are incomplete — only ask AI when the intended label is
 * already among the visible options, or after the full query has been typed.
 */
export async function matchFromCandidates(
  options: HTMLElement[],
  value: string,
  fieldLabel: string | null,
  typedQuery: string | null,
  allowAi = true,
): Promise<{ match: HTMLElement | null; score: number | null; strategy: string }> {
  const local = findLocalMatch(options, value, fieldLabel);
  if (local.match) return local;

  if (!allowAi || !options.length) {
    return { match: null, score: local.score, strategy: local.strategy };
  }

  const labels = options.map(optionText);
  const ai = await askAiMatchOption({
    intendedValue: value,
    options: labels,
    fieldLabel,
    typedQuery,
  });

  const aiConfidence = typeof ai.confidence === "number" ? ai.confidence : 0;
  const el = ai.matched_option ? resolveOptionElement(options, ai.matched_option) : null;
  // Confidence 0 means the model did not consider this the intended entity.
  if (el && aiConfidence > 0) {
    return {
      match: el,
      score: aiConfidence,
      strategy: "ai",
    };
  }

  return { match: null, score: local.score, strategy: local.strategy };
}
