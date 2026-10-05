import { useState, useEffect, useCallback } from "react";
import { ScoutApiClient, type AuthState } from "../api";

const client = new ScoutApiClient();

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });

  const checkAuth = useCallback(async () => {
    setAuthState({ status: "loading" });
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
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        (message.type === "tab-closed" || message.type === "tab-updated")
      ) {
        setTimeout(() => {
          checkAuth();
        }, 1000);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [checkAuth]);

  return { authState, checkAuth };
}
