/** Unique id for one in-flight page fetch. Never reuse the URL as the abort key. */

export function newFetchId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `fetch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
}

export function abortKeyForFetch(fetchId) {
  const id = String(fetchId ?? "").trim();
  return id || newFetchId();
}
