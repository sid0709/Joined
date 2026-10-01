import { LOCALE } from "./config";

export function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString(LOCALE)} ${count === 1 ? singular : plural}`;
}

/** Share of a goal reached, 0–100. */
export function progressTo(value: number, goal: number) {
  if (goal <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((value / goal) * 100)));
}

/** "boards.greenhouse.io" → "Greenhouse · boards.greenhouse.io" when the ATS is known. */
export function sourceLabel(host: string, ats?: string) {
  return ats ? `${ats} · ${host}` : host;
}
