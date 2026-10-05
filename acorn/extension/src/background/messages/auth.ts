import { isAcornSocketConnected } from "../../acorn-socket";
import {
  acornSignIn,
  acornSignOut,
  getAcornSession,
  syncAcornSession,
} from "../../auth/acorn-auth";
import { connectSocket } from "../socket-connection";
import type { RuntimeMessage, SendResponse } from "./shared";

export function handleSocketStatus(sendResponse: SendResponse): void {
  sendResponse({ connected: isAcornSocketConnected() });
}

export function handleAuthStatus(sendResponse: SendResponse): void {
  void syncAcornSession()
    .then(getAcornSession)
    .then((session) => {
      sendResponse({
        signedIn: Boolean(session),
        session,
        connected: isAcornSocketConnected(),
      });
    });
}

export function handleAuthSignIn(message: RuntimeMessage, sendResponse: SendResponse): void {
  void (async () => {
    const result = await acornSignIn(
      typeof message.apiUrl === "string" ? message.apiUrl : undefined,
    );
    if (!result.ok) {
      sendResponse({ ok: false, error: result.error });
      return;
    }
    await connectSocket().catch(() => undefined);
    sendResponse({ ok: true, session: result.session });
  })();
}

export function handleAuthSignOut(sendResponse: SendResponse): void {
  void (async () => {
    try {
      await acornSignOut();
      await connectSocket().catch(() => undefined);
      sendResponse({ ok: true });
    } catch (err) {
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}

export function handleReconnectSocket(sendResponse: SendResponse): void {
  void connectSocket()
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }));
}
