import { useState, useEffect, useCallback, useRef } from "react";
import { ScoutApiClient, type AuthState } from "../api";
import {
  parseTabAuthMessage,
  resolveSignInTabRefresh,
  scheduleAuthRefresh,
} from "../auth/signInTab";

const client = new ScoutApiClient();

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });
  const signInTabIdRef = useRef<number | null>(null);

  const checkAuth = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setAuthState({ status: "loading" });
    }
    try {
      const profile = await client.getMe();
      if (profile) {
        setAuthState({ status: "signed-in", profile });
      } else {
        setAuthState({ status: "signed-out" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setAuthState({ status: "error", error: message });
    }
  }, []);

  useEffect(() => {
    checkAuth();

    const handleMessage = (message: unknown) => {
      const parsed = parseTabAuthMessage(message);
      if (!parsed) {
        return;
      }

      const decision = resolveSignInTabRefresh({
        trackedTabId: signInTabIdRef.current,
        eventType: parsed.type,
        eventTabId: parsed.tabId,
      });
      if (!decision.refresh) {
        return;
      }

      scheduleAuthRefresh(checkAuth);
      signInTabIdRef.current = decision.nextTabId;
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [checkAuth]);

  const setSignInTabId = useCallback((tabId: number | null) => {
    signInTabIdRef.current = tabId;
  }, []);

  return { authState, checkAuth, setSignInTabId };
}
