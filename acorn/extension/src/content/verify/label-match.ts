import { normalize } from "./element-labels";

function labelTokens(text: string): string[] {
  return text
    .replace(/[?*]+$/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** True when every `want` token appears in `have` in order (extra live words allowed). */
function tokenSubsequence(want: string[], have: string[]): boolean {
  if (!want.length) return true;
  let i = 0;
  for (const tok of have) {
    if (tok === want[i]) i += 1;
    if (i === want.length) return true;
  }
  return false;
}

export function labelMatches(expected: string, candidates: string[]): boolean {
  const exp = normalize(expected);
  if (!exp) return true;
  const expBare = exp.replace(/[?*]+$/g, "").trim();
  const want = labelTokens(expBare);
  return candidates.some((c) => {
    const n = normalize(c)
      .replace(/[?*]+$/g, "")
      .trim();
    if (n === exp || n === expBare || n.includes(expBare) || expBare.includes(n)) return true;
    // Plans often truncate long Greenhouse labels; require a long shared prefix.
    const prefixLen = Math.min(72, expBare.length, n.length);
    if (prefixLen >= 40 && n.slice(0, prefixLen) === expBare.slice(0, prefixLen)) {
      return true;
    }
    const have = labelTokens(n);
    const smaller = want.length <= have.length ? want : have;
    const larger = want.length <= have.length ? have : want;
    if (!tokenSubsequence(smaller, larger)) return false;
    if (smaller.length >= 4) return true;
    return smaller.length / Math.max(larger.length, 1) >= 0.75;
  });
}
