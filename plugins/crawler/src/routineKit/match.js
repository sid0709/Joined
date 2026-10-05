/** True when `hostname` is one of `hosts` or a subdomain of one. */
export function hostMatches(hostname, hosts) {
  const host = String(hostname || "").toLowerCase();
  return hosts.some((candidate) => {
    const allowed = candidate.toLowerCase();
    return host === allowed || host.endsWith(`.${allowed}`);
  });
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

/** The first routine that runs on `url`, or null. */
export function findRoutineForUrl(routines, url) {
  return routines.find((routine) => routineMatchesUrl(routine, url)) ?? null;
}
