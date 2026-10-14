/** The four states every data-loading screen shows. */
export type AsyncStatus = "loading" | "empty" | "error" | "ready";

/** A failed request outranks stale data; loading outranks "empty" so a blank never flashes. */
export function resolveAsyncStatus({
  isLoading,
  error,
  isEmpty,
}: {
  isLoading: boolean;
  error?: string | null;
  isEmpty: boolean;
}): AsyncStatus {
  if (isLoading) return "loading";
  if (error) return "error";
  return isEmpty ? "empty" : "ready";
}

export const LOAD_ERROR_TITLE = "We couldn’t load this";
export const LOAD_ERROR_FALLBACK = "Check your connection and try again.";
export const LOAD_RETRY_LABEL = "Try again";
