export function definedEntries(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

export function appendNotice(current, message) {
  const next = String(message || "").trim();
  if (!next) return current ?? null;
  const existing = String(current || "").trim();
  if (!existing) return next;
  if (existing.split("\n").includes(next)) return existing;
  return `${existing}\n${next}`;
}

/**
 * Merge a pace snapshot without letting omitted jobIndex/jobsOnPage wipe the
 * panel cursor. Each not-marked log is kept so the errors banner lists every job.
 */
export function mergePace(current, next = {}) {
  const hearted = (current?.hearted ?? 0) + (next.heartDelta?.hearted ?? 0);
  const notHearted = (current?.notHearted ?? 0) + (next.heartDelta?.notHearted ?? 0);
  const marked = (current?.marked ?? 0) + (next.markDelta?.marked ?? 0);
  const notMarked = (current?.notMarked ?? 0) + (next.markDelta?.notMarked ?? 0);
  const markReasons = [...(current?.markReasons ?? [])];
  if (next.markDelta?.reason) markReasons.push(next.markDelta.reason);
  const markLogs = [...(current?.markLogs ?? [])];
  if (next.markDelta?.log) markLogs.push(next.markDelta.log);
  return {
    ...current,
    ...definedEntries(next),
    hearted,
    notHearted,
    marked,
    notMarked,
    markReasons,
    markLogs,
    heartDelta: undefined,
    markDelta: undefined,
  };
}
