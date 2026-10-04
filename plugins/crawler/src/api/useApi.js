import { useState, useCallback, useMemo } from "react";

// Minimal useApi hook for GET/POST JSON requests with loading/error state
export default function useApi(baseUrl) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const resolvedBaseUrl = useMemo(() => {
    if (!baseUrl) return null;
    const trimmed = String(baseUrl).trim();
    if (!trimmed) return null;
    return trimmed.replace(/\/$/, "");
  }, [baseUrl]);

  const buildUrl = useCallback(
    (path) => {
      if (!path) throw new Error("Missing request path");
      if (/^https?:\/\//i.test(path)) return path;
      if (!resolvedBaseUrl) throw new Error("API base URL is not configured");
      return `${resolvedBaseUrl}/${path.replace(/^\//, "")}`;
    },
    [resolvedBaseUrl],
  );

  const request = useCallback(
    async (path, options = {}) => {
      setLoading(true);
      setError(null);
      try {
        const url = buildUrl(path);
        const res = await fetch(url, {
          headers: { "Content-Type": "application/json" },
          ...options,
          body:
            options.body && typeof options.body !== "string"
              ? JSON.stringify(options.body)
              : options.body,
        });
        const text = await res.text();
        // Try parse JSON, fallback to text
        let data = text;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (e) {
          console.error("Failed to parse response as JSON", e);
        }
        if (!res.ok) {
          const err = new Error("Request failed");
          err.status = res.status;
          err.data = data;
          throw err;
        }
        setLoading(false);
        return data;
      } catch (err) {
        setError(err);
        setLoading(false);
        throw err;
      }
    },
    [buildUrl],
  );

  const get = useCallback((path) => request(path, { method: "GET" }), [request]);
  const post = useCallback((path, body) => request(path, { method: "POST", body }), [request]);

  return { loading, error, get, post, request, baseUrl: resolvedBaseUrl };
}
