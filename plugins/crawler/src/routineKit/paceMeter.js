/** Rolling jobs/s over a short window. */

export const PACE_WINDOW_MS = 5_000;

export function createPaceMeter({ windowMs = PACE_WINDOW_MS, now = Date.now } = {}) {
  const stamps = [];

  function prune(at) {
    const cutoff = at - windowMs;
    while (stamps.length && stamps[0] < cutoff) stamps.shift();
  }

  return {
    mark() {
      const at = now();
      stamps.push(at);
      prune(at);
    },
    jobsPerSecond() {
      const at = now();
      prune(at);
      if (!stamps.length) return 0;
      const span = Math.max(at - stamps[0], 1);
      const window = Math.min(span, windowMs);
      return stamps.length / (window / 1000);
    },
    get count() {
      prune(now());
      return stamps.length;
    },
  };
}
