import { isProperTokenExtension, isTokenPrefixMatch, stripChoiceMarker } from "./string-similarity";

const MAGNITUDE_UNIT = /\b(years?|yrs?|months?|mos?|hours?|hrs?|days?|weeks?)\b/i;
const LESS_THAN = /(?:less than|under|below|fewer than|up to|<)\s*(\d+(?:\.\d+)?)/i;
const AT_LEAST = /(?:at least|or more|and above|over|more than|>)\s*(\d+(?:\.\d+)?)/i;
const PLUS = /(\d+(?:\.\d+)?)\s*\+/;
const SPAN = /(\d+(?:\.\d+)?)\s*[-–—to]+\s*(\d+(?:\.\d+)?)/i;

export type MagnitudeRange = { min: number; max: number };

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").replace(/[–—]/g, "-").trim().toLowerCase();
}

/** Split a planned answer into independent option fragments. */
export function intendedParts(value: string): string[] {
  return value
    .split(/\s*(?:,|;|\/|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

/**
 * Parse a numeric magnitude range from a label ("7+ years", "3-5", "less than 3").
 * Ignores labels that are not magnitude answers (no unit and not a short numeric phrase).
 */
export function parseMagnitudeRange(text: string): MagnitudeRange | null {
  const bare = stripChoiceMarker(text);
  const compact = normalize(bare);
  if (!compact) return null;
  const hasUnit = MAGNITUDE_UNIT.test(compact);
  const shortNumeric =
    compact.length <= 24 &&
    /^\d/.test(compact.replace(/^(less than|under|below|at least|over|more than)\s+/i, ""));
  if (!hasUnit && !shortNumeric) return null;

  const less = compact.match(LESS_THAN);
  if (less) {
    const max = Number(less[1]);
    return Number.isFinite(max) ? { min: 0, max } : null;
  }
  const plus = compact.match(PLUS);
  if (plus) {
    const min = Number(plus[1]);
    return Number.isFinite(min) ? { min, max: Number.POSITIVE_INFINITY } : null;
  }
  const atLeast = compact.match(AT_LEAST);
  if (atLeast) {
    const min = Number(atLeast[1]);
    return Number.isFinite(min) ? { min, max: Number.POSITIVE_INFINITY } : null;
  }
  const span = compact.match(SPAN);
  if (span) {
    const min = Number(span[1]);
    const max = Number(span[2]);
    if (Number.isFinite(min) && Number.isFinite(max) && max >= min) {
      return { min, max };
    }
  }
  return null;
}

function rangesOverlap(a: MagnitudeRange, b: MagnitudeRange): boolean {
  return a.min <= b.max && b.min <= a.max;
}

/**
 * When the intended value and several options are magnitude ranges,
 * pick the overlapping option whose lower bound is closest to the intended min.
 */
export function bestMagnitudeRangeMatch<T>(
  target: string,
  candidates: T[],
  getText: (item: T) => string,
): T | null {
  const want = parseMagnitudeRange(target);
  if (!want) return null;
  const ranged = candidates
    .map((item) => {
      const range = parseMagnitudeRange(getText(item));
      return range ? { item, range } : null;
    })
    .filter((row): row is { item: T; range: MagnitudeRange } => Boolean(row));
  if (ranged.length < 2) return null;

  const overlapping = ranged.filter((row) => rangesOverlap(want, row.range));
  if (!overlapping.length) return null;

  overlapping.sort((a, b) => {
    const da = Math.abs(a.range.min - want.min);
    const db = Math.abs(b.range.min - want.min);
    if (da !== db) return da - db;
    const aOpen = !Number.isFinite(a.range.max);
    const bOpen = !Number.isFinite(b.range.max);
    if (aOpen !== bOpen) return aOpen ? 1 : -1;
    return a.range.max - b.range.max;
  });
  return overlapping[0].item;
}

function polarityOf(text: string): "yes" | "no" | null {
  const n = normalize(stripChoiceMarker(text));
  if (!n) return null;
  if (
    /^(no|n|false|decline|disagree|do not|don't|i do not|i don't|not eligible|i do not consent|i do not agree)\b/.test(
      n,
    )
  ) {
    return "no";
  }
  if (
    /^(yes|y|true|agree|consent|acknowledge|accept|i agree|i consent|i acknowledge|i accept)\b/.test(
      n,
    )
  ) {
    return "yes";
  }
  return null;
}

/**
 * Two-option yes/no (or agree/decline) lists: map an acknowledgment/agreement
 * intended value onto the affirmative choice.
 */
export function bestBinaryPolarityMatch<T>(
  target: string,
  candidates: T[],
  getText: (item: T) => string,
): T | null {
  if (candidates.length !== 2) return null;
  const want = polarityOf(target);
  if (!want) return null;
  const polar = candidates.map((item) => ({ item, pole: polarityOf(getText(item)) }));
  if (polar.some((row) => !row.pole)) return null;
  if (polar[0].pole === polar[1].pole) return null;
  return polar.find((row) => row.pole === want)?.item ?? null;
}

function looksLikeNoneExperience(text: string): boolean {
  const n = normalize(stripChoiceMarker(text));
  if (!n) return false;
  if (/^(none|neither|n\/a|not applicable)\b/.test(n)) return true;
  if (/\bno experience\b|\bunfamiliar\b|\bnever (used|done)\b/.test(n)) return true;
  return false;
}

function looksLikeStrongExperience(text: string): boolean {
  return /\b(strong|expert|extensive|significant|multiple|both|production|proven|architected)\b/i.test(
    text,
  );
}

/**
 * Short yes/no intended value against a lettered experience scale:
 * No → the none/unfamiliar option; Yes → the strongest remaining option.
 */
export function bestScalePolarityMatch<T>(
  target: string,
  candidates: T[],
  getText: (item: T) => string,
): T | null {
  if (candidates.length < 3) return null;
  const want = polarityOf(target);
  if (!want) return null;
  if (candidates.every((item) => polarityOf(getText(item)))) return null;
  const noneOpts = candidates.filter((item) => looksLikeNoneExperience(getText(item)));
  const someOpts = candidates.filter((item) => !looksLikeNoneExperience(getText(item)));
  if (want === "no") return noneOpts.length === 1 ? noneOpts[0] : null;
  if (!someOpts.length) return null;
  const strong = someOpts.filter((item) => looksLikeStrongExperience(getText(item)));
  if (strong.length) return strong[strong.length - 1];
  return someOpts[someOpts.length - 1];
}

function looksLikeUmbrellaOption(text: string): boolean {
  return /\b(multiple|several|various|combination|all of the above|many of the above)\b/i.test(
    text,
  );
}

/**
 * Short intended token not present in the list: pick the sole "multiple/several"
 * option when that umbrella can cover the named item.
 */
export function bestUmbrellaMatch<T>(
  target: string,
  candidates: T[],
  getText: (item: T) => string,
): T | null {
  if (candidates.length < 3) return null;
  if (polarityOf(target)) return null;
  const want = normalize(stripChoiceMarker(target));
  if (want.length < 3) return null;
  const contained = candidates.some((item) =>
    normalize(stripChoiceMarker(getText(item))).includes(want),
  );
  if (contained) return null;
  const umbrellas = candidates.filter((item) => looksLikeUmbrellaOption(getText(item)));
  if (umbrellas.length === 1) return umbrellas[0];
  if (umbrellas.length > 1) return umbrellas[umbrellas.length - 1];
  return null;
}

/** True when `option` begins with the intended fragment (closed-list short tokens). */
export function optionStartsWithIntended(intended: string, option: string): boolean {
  const want = normalize(stripChoiceMarker(intended));
  const have = normalize(stripChoiceMarker(option));
  if (want.length < 3 || have.length < want.length) return false;
  if (isProperTokenExtension(intended, option)) return false;
  if (have === want) return true;
  if (have.startsWith(want) && /[^a-z0-9]/.test(have.charAt(want.length))) return true;
  return isTokenPrefixMatch(want, have);
}
