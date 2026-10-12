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
  let pastCursor = !lastJobId;
  for (const card of cards) {
    if (!pastCursor) {
      if (String(card.id) === String(lastJobId)) pastCursor = true;
      continue;
    }
    if (!isJobHandled(card, handledIds)) return card;
  }
  return null;
}
