import type { ApplicantProfile } from "./profile";

/**
 * Which words a posting leans on, and whether the profile already says them. A quick,
 * local read — no model call — so it can update on every keystroke.
 */

export const KEYWORD_LIMIT = 14;
const MIN_WORD = 3;
/** Words this long are compared on their stem, so "scaling" matches "scale". */
const STEM_FROM = 6;
const STEM_TRIM = 3;

const STOPWORDS = new Set(
  (
    "a about above across after again all also an and any are as at be been being both but by can " +
    "could did do does doing each few for from further had has have having he her here hers how i if " +
    "in into is it its itself just me more most my no nor not now of off on once only or other our " +
    "ours out over own same she should so some such than that the their them then there these they " +
    "this those through to too under until up very was we were what when where which while who whom " +
    "why will with would you your yours able work working team teams role roles join help " +
    "looking youll we're you'll well strong experience years year plus including include etc new " +
    "great good using use used within ability skills skill must nice like make makes build " +
    "building builds owns owning responsibilities requirements preferred qualifications"
  ).split(" "),
);

function words(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^[-.]+|[-.]+$/g, ""))
    .filter((word) => word.length >= MIN_WORD && !STOPWORDS.has(word) && !/^\d+$/.test(word));
}

/** The posting's most repeated meaningful words, in order of weight. */
export function postingKeywords(text: string, limit = KEYWORD_LIMIT): string[] {
  const counts = new Map<string, number>();
  words(text).forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([word]) => word);
}

export function profileText(profile: ApplicantProfile) {
  return profile.timeline
    .map((entry) => `${entry.title} ${entry.org} ${entry.summary}`)
    .join(" ")
    .toLowerCase();
}

function stem(word: string) {
  return word.length >= STEM_FROM ? word.slice(0, word.length - STEM_TRIM) : word;
}

export type KeywordMatch = { matched: string[]; missing: string[]; score: number };

export function matchKeywords(keywords: string[], corpus: string): KeywordMatch {
  const matched = keywords.filter((word) => corpus.includes(stem(word)));
  const missing = keywords.filter((word) => !matched.includes(word));
  return {
    matched,
    missing,
    score: keywords.length ? Math.round((matched.length / keywords.length) * 100) : 0,
  };
}
