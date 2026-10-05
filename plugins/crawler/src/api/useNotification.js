import { useToast } from "sid-ui";
import { useMemo, useCallback } from "react";

export function formatFailureMessage(err, fallback = "Something went wrong") {
  if (!err) return fallback;
  if (typeof err === "string") return err;

  const message = err?.message || "";
  if (
    message === "Failed to fetch" ||
    err?.name === "TypeError" ||
    /failed to fetch|networkerror/i.test(message)
  ) {
    return "Failed to connect to backend API. Check that the server is running and plugins/crawler/.env is configured.";
  }
  if (message === "API base URL is not configured") {
    return "API base URL is not configured. Set VITE_API_URL in plugins/crawler/.env and rebuild the extension.";
  }
  if (message === "Request failed") {
    const detail = err?.data?.message || err?.data?.error;
    return detail ? `Backend request failed: ${detail}` : "Backend request failed.";
  }

  return message || fallback;
}

const useNotification = () => {
  const toast = useToast();

  const showNotification = useCallback(
    (message, options = {}) => {
      const { variant = "default", autoHideDuration = 2500, key } = options;

      // Joined toasts are info or error. A `key` replaces the toast already showing under it.
      toast({
        body: message,
        type: variant === "error" ? "error" : "info",
        autoHideDuration,
        ...(key ? { uniqueID: key, collisionBehavior: "overwrite" } : {}),
      });
    },
    [toast],
  );

  return useMemo(
    () => ({
      showNotification,
      success: (message, options) => showNotification(message, { variant: "success", ...options }),
      error: (message, options) => showNotification(message, { variant: "error", ...options }),
      warning: (message, options) => showNotification(message, { variant: "warning", ...options }),
      info: (message, options) => showNotification(message, { variant: "info", ...options }),
      fail: (err, options) =>
        showNotification(formatFailureMessage(err), { variant: "error", ...options }),
    }),
    [showNotification],
  );
};

export default useNotification;
