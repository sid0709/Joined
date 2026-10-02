import { useEffect, useState } from "react";
import type { AcornStoredSession } from "../auth/acorn-auth";
import { MSG, ACORN_SIDEBAR_PORT } from "../types";
import { sendMessage } from "./runtime";

/**
 * Whether the service worker's socket is connected. Holds a port to the worker (which
 * also keeps it awake) and re-asks on an interval whenever the session or API URL changes.
 */
export function useSocketStatus(session: AcornStoredSession | null, apiUrl: string) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let port: chrome.runtime.Port | null = null;

    const attach = () => {
      if (cancelled) return;
      port = chrome.runtime.connect({ name: ACORN_SIDEBAR_PORT });
      port.onMessage.addListener((message: { type?: string; connected?: boolean }) => {
        if (message?.type === MSG.SOCKET_STATUS) {
          setConnected(Boolean(message.connected));
        }
      });
      port.onDisconnect.addListener(() => {
        port = null;
        if (!cancelled) window.setTimeout(attach, 250);
      });
    };

    attach();
    return () => {
      cancelled = true;
      port?.disconnect();
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const check = async () => {
      try {
        const res = await sendMessage<{ connected?: boolean }>({ type: MSG.SOCKET_STATUS });
        if (alive && typeof res?.connected === "boolean") {
          setConnected(res.connected);
        }
      } catch {
        if (alive) setConnected(false);
      }
    };

    check();
    const id = setInterval(check, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [session, apiUrl]);

  return connected;
}
