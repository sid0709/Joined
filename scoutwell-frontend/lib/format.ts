import { LOCALE } from "./config";

export function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString(LOCALE)} ${count === 1 ? singular : plural}`;
}

/** Share of a goal reached, 0–100. */
export function progressTo(value: number, goal: number) {
  if (goal <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((value / goal) * 100)));
}

/** Splits "remote, Visa ,remote" into unique lowercase tags. */
export function parseTags(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

/** Splits "Go, Kubernetes ,go" into unique skills, keeping the first spelling. */
export function parseList(value: string) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value.split(",").map((part) => part.trim())) {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** "boards.greenhouse.io" → "Greenhouse · boards.greenhouse.io" when the ATS is known. */
export function sourceLabel(host: string, ats?: string) {
  return ats ? `${ats} · ${host}` : host;
}
