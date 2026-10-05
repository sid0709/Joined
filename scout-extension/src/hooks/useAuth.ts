import { useState, useEffect, useCallback, useRef } from "react";
import { ScoutApiClient, type AuthState } from "../api";

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
      if (typeof message === "object" && message !== null && "type" in message) {
        if (message.type === "tab-closed" && "tabId" in message) {
          if (signInTabIdRef.current === message.tabId) {
            signInTabIdRef.current = null;
            setTimeout(() => {
              checkAuth(false);
            }, 1000);
          }
        } else if (message.type === "tab-updated" && "tabId" in message) {
          if (signInTabIdRef.current === message.tabId) {
            setTimeout(() => {
              checkAuth(false);
            }, 1000);
          }
        }
      }
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
