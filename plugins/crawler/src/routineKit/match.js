/** True when `hostname` is one of `hosts` or a subdomain of one. */
export function hostMatches(hostname, hosts) {
  const host = String(hostname || "").toLowerCase();
  return (hosts ?? []).some((candidate) => {
    const allowed = candidate.toLowerCase();
    return host === allowed || host.endsWith(`.${allowed}`);
  });
}

/**
 * Resolve `url` and require it to be http(s) on one of `hosts`.
 * `base` is the tab URL when `url` may be relative.
 */
export function assertFetchUrl(url, hosts, base) {
  let resolved;
  try {
    resolved = base ? new URL(url, base) : new URL(url);
  } catch {
    throw new Error("Fetch URL is invalid");
  }
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    throw new Error("Fetch is limited to http(s) URLs");
  }
  if (!Array.isArray(hosts) || !hosts.length || !hostMatches(resolved.hostname, hosts)) {
    throw new Error("Fetch is limited to this routine's hosts");
  }
  return resolved.href;
}

export function routineMatchesUrl(routine, url) {
  try {
    const { protocol, hostname } = new URL(url);
    return (
      (protocol === "http:" || protocol === "https:") && hostMatches(hostname, routine.match.hosts)
    );
  } catch {
    return false;
  }
}

/** Every routine that runs on `url`, in registry order. */
export function findRoutinesForUrl(routines, url) {
  return routines.filter((routine) => routineMatchesUrl(routine, url));
}

/** The first routine that runs on `url`, or null. */
export function findRoutineForUrl(routines, url) {
  return routines.find((routine) => routineMatchesUrl(routine, url)) ?? null;
}
