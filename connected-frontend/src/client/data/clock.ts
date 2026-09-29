/** Fixed mock clock so server and client render the same values. */
export const MOCK_NOW = new Date("2026-09-28T13:00:00Z");

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

export function isoAgo(days: number, hours = 0): string {
  return new Date(MOCK_NOW.getTime() - days * MS_PER_DAY - hours * MS_PER_HOUR).toISOString();
}

export function isoAhead(days: number): string {
  return new Date(MOCK_NOW.getTime() + days * MS_PER_DAY).toISOString();
}

/** Small deterministic PRNG so generated mock data is stable between renders. */
export function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Calendar day (YYYY-MM-DD) a number of days from the mock day; negative is the past. */
export function ymdFromNow(days: number): string {
  return new Date(MOCK_NOW.getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The job hunter's wall clock on the mock day: what "today" and "now" mean on the calendar. */
export const MOCK_TODAY = ymdFromNow(0);
export const MOCK_WALL_TIME = "09:00";
