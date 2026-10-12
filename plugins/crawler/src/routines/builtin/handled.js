/** Whether a Built In job should be skipped on this or a later run. */

export function handledIdSet(ids) {
  return new Set((ids ?? []).map((id) => String(id)).filter(Boolean));
}

export function isJobHandled({ id, isSaved = false }, handledIds) {
  if (!id) return false;
  if (handledIds?.has?.(String(id))) return true;
  return isSaved === true;
}

/** Cards after the resume cursor. The cursor card itself was already decided. */
export function cardsAfterCursor(cards, lastJobId = "") {
  const resumeId = lastJobId ? String(lastJobId) : "";
  if (!resumeId) return cards;
  const start = cards.findIndex((card) => String(card.id) === resumeId);
  if (start < 0) return cards;
  return cards.slice(start + 1);
}

export function unhandledCards(cards, handledIds, lastJobId = "") {
  return cardsAfterCursor(cards, lastJobId).filter((card) => !isJobHandled(card, handledIds));
}

export function nextUnhandledCard(cards, handledIds, lastJobId = "") {
  return unhandledCards(cards, handledIds, lastJobId)[0] ?? null;
}

/** lastJobId may only move forward over a contiguous prefix of handled cards. */
export function contiguousLastJobId(cards, handledIds, lastJobId = "") {
  const resumeId = lastJobId ? String(lastJobId) : "";
  const resumeOnPage = Boolean(resumeId && cards.some((card) => String(card.id) === resumeId));
  let pastCursor = !resumeOnPage;
  let last = resumeOnPage ? resumeId : lastJobId;
  for (const card of cards) {
    const id = String(card.id);
    if (!pastCursor) {
      if (id === resumeId) pastCursor = true;
      continue;
    }
    if (!handledIds?.has?.(id)) break;
    last = id;
  }
  return last || "";
}
