import { useEffect, useMemo, useState } from "react";

import { API_URL, HEALTH_PATH } from "../config/env";

import { BackendHealthContext } from "./backendHealthContext";

const HEALTH_POLL_MS = 10_000;

function resolveHealthUrl(apiUrl) {
  if (!apiUrl) return null;
  try {
    const url = new URL(apiUrl);
    url.pathname = HEALTH_PATH;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function BackendHealthProvider({ children }) {
  const healthUrl = useMemo(() => resolveHealthUrl(API_URL), []);
  const [status, setStatus] = useState(healthUrl ? "connecting" : "unconfigured");
  const [serverInfo, setServerInfo] = useState(null);

  useEffect(() => {
    if (!healthUrl) {
      setStatus("unconfigured");
      setServerInfo(null);
      return undefined;
    }

    let cancelled = false;
    let controller = null;
    const checkHealth = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch(healthUrl, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || data?.ok !== true) throw new Error("Backend health check failed");
        if (!cancelled) {
          setServerInfo(data);
          setStatus("connected");
        }
      } catch (error) {
        if (!cancelled && error?.name !== "AbortError") {
          setServerInfo(null);
          setStatus("disconnected");
        }
      }
    };

    setStatus("connecting");
    void checkHealth();
    const interval = setInterval(() => void checkHealth(), HEALTH_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      controller?.abort();
    };
  }, [healthUrl]);

  const value = useMemo(() => ({ status, serverInfo, apiUrl: API_URL }), [status, serverInfo]);
  return <BackendHealthContext.Provider value={value}>{children}</BackendHealthContext.Provider>;
}
