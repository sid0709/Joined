export function normalizeText(text) {
  return (text == null ? "" : String(text)).trim().replace(/\s+/g, " ").toLowerCase();
}

export function deriveSelectionCandidates(text) {
  const raw = text == null ? "" : String(text);
  const candidates = new Set();

  for (const phrase of extractQuotedPhrases(raw)) candidates.add(phrase);
  candidates.add(raw);

  const cleaned = raw
    .replace(/^[\s\-–—]*\b(please\s+)?(select|choose|pick)\b[:\s]*/i, "")
    .replace(/[.!\s]+$/g, "")
    .trim();
  if (cleaned) candidates.add(cleaned);

  const lowered = normalizeText(raw);
  if (lowered.startsWith("yes")) candidates.add("Yes");
  if (lowered.startsWith("no")) candidates.add("No");

  return Array.from(candidates).filter(Boolean);
}

export function extractQuotedPhrases(text) {
  const value = text == null ? "" : String(text);
  const phrases = [];
  const regex = /"([^"]+)"|“([^”]+)”/g;
  let match;
  while ((match = regex.exec(value)) !== null) {
    const phrase = (match[1] || match[2] || "").trim();
    if (phrase) phrases.push(phrase);
  }
  return phrases;
}

function scoreTokenOverlap(a, b) {
  const ta = new Set(normalizeText(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  return overlap / Math.max(ta.size, tb.size);
}

export function findBestMatchingNode(nodes, desiredText) {
  if (!Array.isArray(nodes) || nodes.length === 0) return null;
  const desired = normalizeText(desiredText);
  if (!desired) return null;

  // Exact
  for (const node of nodes) {
    const text = normalizeText(node?.textContent || node?.innerText || "");
    if (text === desired) return node;
  }
  // Contains
  for (const node of nodes) {
    const text = normalizeText(node?.textContent || node?.innerText || "");
    if (text && text.includes(desired)) return node;
  }
  // Reverse contains (desired contains option) for long instruction strings
  for (const node of nodes) {
    const text = normalizeText(node?.textContent || node?.innerText || "");
    if (text && desired.includes(text)) return node;
  }

  // Fuzzy token overlap (handles "Not a veteran." vs "I am not a protected veteran")
  let best = null;
  let bestScore = 0;
  for (const node of nodes) {
    const text = node?.textContent || node?.innerText || "";
    const score = scoreTokenOverlap(desiredText, text);
    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  }
  if (best && bestScore >= 0.34) return best;

  return null;
}
