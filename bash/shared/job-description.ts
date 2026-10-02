/** Read already-saved JD text from a Worker pool / Job Search list item. */

const JD_KEYS = ["jobDescription", "job_description", "jdText", "jd", "description"] as const;

const NESTED_KEYS = ["job", "analysis", "posting", "fields"] as const;

export function readStoredJobDescription(raw: unknown): string | null {
  if (typeof raw === "string") {
    const text = raw.trim();
    return text || null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  for (const key of JD_KEYS) {
    const value = row[key];
    if (typeof value === "string") {
      const text = value.trim();
      if (text) return text;
    }
  }
  for (const key of NESTED_KEYS) {
    const nested = row[key];
    if (nested && typeof nested === "object") {
      const found = readStoredJobDescription(nested);
      if (found) return found;
    }
  }
  return null;
}
