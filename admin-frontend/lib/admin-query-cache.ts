/** How long a list response stays instant before the next read refreshes it. */
export const ADMIN_QUERY_FRESH_MS = 30_000;

const ADMIN_QUERY_CACHE_LIMIT = 40;

type Entry = { result: unknown; storedAt: number };

export type AdminQueryHit<T> = { result: T; fresh: boolean };

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const generation = new Map<string, number>();

export function readAdminQuery<T>(path: string, now = Date.now()): AdminQueryHit<T> | null {
  const hit = cache.get(path);
  if (!hit) return null;
  return { result: hit.result as T, fresh: now - hit.storedAt < ADMIN_QUERY_FRESH_MS };
}

export function rememberAdminQuery<T>(path: string, result: T, now = Date.now()) {
  cache.delete(path);
  cache.set(path, { result, storedAt: now });
  while (cache.size > ADMIN_QUERY_CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Keeps a server-rendered page unless the browser already has a newer copy. */
export function seedAdminQuery<T>(path: string, result: T, now = Date.now()) {
  if (!cache.has(path)) rememberAdminQuery(path, result, now);
}

export function pendingAdminQuery<T>(path: string): Promise<T> | undefined {
  return inflight.get(path) as Promise<T> | undefined;
}

/**
 * Shares one request for a path. A later forget() drops a late response so a
 * reload cannot be overwritten by the request it replaced.
 */
export function trackAdminQuery<T>(path: string, task: Promise<T>): Promise<T> {
  const issued = generation.get(path) ?? 0;
  const tracked = task.then(
    (result) => {
      inflight.delete(path);
      if ((generation.get(path) ?? 0) === issued) rememberAdminQuery(path, result);
      return result;
    },
    (cause: unknown) => {
      inflight.delete(path);
      throw cause;
    },
  );
  inflight.set(path, tracked);
  return tracked;
}

/** Starts a fetch when the path is not already fresh or in flight. */
export function warmAdminQuery(path: string | null, load: (path: string) => Promise<unknown>) {
  if (!path || readAdminQuery(path)?.fresh || pendingAdminQuery(path)) return Promise.resolve();
  return trackAdminQuery(path, load(path)).catch(() => {});
}

export function forgetAdminQuery(path: string) {
  cache.delete(path);
  inflight.delete(path);
  generation.set(path, (generation.get(path) ?? 0) + 1);
}

export function clearAdminQueryCache() {
  cache.clear();
  inflight.clear();
  generation.clear();
}

/** Same admin path with `page` replaced. */
export function adminQueryAtPage(path: string, page: number) {
  const split = path.indexOf("?");
  const base = split === -1 ? path : path.slice(0, split);
  const params = new URLSearchParams(split === -1 ? "" : path.slice(split + 1));
  params.set("page", String(page));
  return `${base}?${params}`;
}

/** The following page, or null once `total` says this page is the last. */
export function prefetchAdminPath(path: string, page: number, pageSize: number, total?: number) {
  if (total !== undefined && page * pageSize >= total) return null;
  return adminQueryAtPage(path, page + 1);
}
