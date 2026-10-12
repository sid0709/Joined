/** Whether a Built In job should be skipped on this or a later run. */

export function handledIdSet(ids) {
  return new Set((ids ?? []).map((id) => String(id)).filter(Boolean));
}

export function isJobHandled({ id, isSaved = false, hasSavedTag = false }, handledIds) {
  if (!id) return false;
  if (handledIds?.has?.(String(id))) return true;
  return isSaved === true || hasSavedTag === true;
}

export function nextUnhandledCard(cards, handledIds, lastJobId = "") {
  const resumeId = lastJobId ? String(lastJobId) : "";
  const resumeOnPage = Boolean(resumeId && cards.some((card) => String(card.id) === resumeId));
  let pastCursor = !resumeOnPage;
  for (const card of cards) {
    if (!pastCursor) {
      if (String(card.id) === resumeId) pastCursor = true;
      continue;
    }
    if (!isJobHandled(card, handledIds)) return card;
  }
  return null;
}
