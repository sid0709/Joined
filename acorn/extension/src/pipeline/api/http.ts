const GENERIC_HTTP_ERRORS = new Set([
  "Bad Request",
  "Unauthorized",
  "Forbidden",
  "Not Found",
  "Internal Server Error",
]);

export function extractError(
  data: { error?: unknown; message?: unknown },
  fallback: string,
): string {
  const nested =
    data.message && typeof data.message === "object"
      ? (data.message as { error?: unknown; message?: unknown })
      : null;
  for (const candidate of [data.error, nested?.error, data.message, nested?.message]) {
    if (typeof candidate === "string" && candidate.trim()) {
      const text = candidate.trim();
      if (!GENERIC_HTTP_ERRORS.has(text) && !/^Cannot (GET|POST|PUT|PATCH|DELETE)\b/i.test(text)) {
        return text;
      }
    }
  }
  return fallback;
}

export function readInputId(data: {
  inputId?: unknown;
  task?: { progress?: { inputId?: unknown } } | null;
}): string {
  const top = String(data.inputId || "").trim();
  if (top) return top;
  return String(data.task?.progress?.inputId || "").trim();
}

export function readId(value: unknown): string | null {
  const text = String(value || "").trim();
  return text || null;
}

export function isNestMissingRoute(
  status: number,
  data: { message?: unknown; error?: unknown },
): boolean {
  if (status !== 404) return false;
  const message = typeof data.message === "string" ? data.message : "";
  return /^Cannot (GET|POST|PUT|PATCH|DELETE)\b/i.test(message);
}
