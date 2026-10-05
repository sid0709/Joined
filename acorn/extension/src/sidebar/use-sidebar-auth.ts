import { useEffect, useState } from "react";
import {
  DEFAULT_ACORN_API_URL,
  getAcornApiUrl,
  getAcornSession,
  type AcornStoredSession,
} from "../auth/acorn-auth";
import { MSG } from "../types";
import { pushAcornNotice } from "./acorn-notice";
import { sendMessage } from "./runtime";

/** Sidebar sign-in state: API URL, Acorn session, and the sign in / sign out actions. */
export function useSidebarAuth({ onSignedOut }: { onSignedOut: () => void }) {
  const [apiUrl, setApiUrl] = useState(DEFAULT_ACORN_API_URL);
  const [session, setSession] = useState<AcornStoredSession | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      setApiUrl(await getAcornApiUrl());
      setSession(await getAcornSession());
    })();
  }, []);

  const handleSignIn = async () => {
    setAuthBusy(true);
    try {
      const res = await sendMessage<{
        ok?: boolean;
        error?: string;
        session?: AcornStoredSession;
      }>({
        type: MSG.AUTH_SIGNIN,
        apiUrl,
      });
      if (!res?.ok || !res.session) {
        pushAcornNotice({
          kind: "error",
          title: "Couldn’t sign in",
          detail: res?.error || "Sign in on the Acorn site in this browser first.",
        });
        return;
      }
      setSession(res.session);
      pushAcornNotice({
        kind: "success",
        title: "Signed in",
        detail: `Welcome back, ${res.session.displayName}.`,
      });
    } catch (err) {
      pushAcornNotice({
        kind: "error",
        title: "Couldn’t sign in",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    try {
      const res = await sendMessage<{ ok?: boolean; error?: string }>({
        type: MSG.AUTH_SIGNOUT,
      });
      if (!res?.ok) {
        pushAcornNotice({
          kind: "error",
          title: "Couldn’t sign out",
          detail: res?.error || "Try again in a moment.",
        });
        return;
      }
      setSession(null);
      onSignedOut();
      pushAcornNotice({ kind: "success", title: "Signed out" });
    } catch (err) {
      pushAcornNotice({
        kind: "error",
        title: "Couldn’t sign out",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setAuthBusy(false);
    }
  };

  return { apiUrl, setApiUrl, session, authBusy, handleSignIn, handleSignOut };
}
