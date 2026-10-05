import { MSG, type AcornNoticePayload } from "./types";

export function broadcastOperatorNotice(notice: AcornNoticePayload): void {
  chrome.runtime.sendMessage({ type: MSG.OPERATOR_NOTICE, notice }, () => {
    void chrome.runtime.lastError;
  });
}

export function socketErrorDetail(message: string): string {
  const text = message.toLowerCase();
  if (
    text.includes("xhr") ||
    text.includes("websocket") ||
    text.includes("timeout") ||
    text.includes("transport")
  ) {
    return "Couldn’t reach Acorn. Check the API URL and that the backend is running.";
  }
  if (text.includes("auth") || text.includes("unauthorized") || text.includes("jwt")) {
    return "Session expired. Sign in again.";
  }
  return message.trim() || "Couldn’t reach Acorn.";
}

export function networkErrorDetail(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Couldn’t reach Acorn. Check the API URL and that the backend is running.";
  }
  return message.trim() || fallback;
}
