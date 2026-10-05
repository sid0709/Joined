import type { PipelineProgress } from "@acorn/shared/pipeline-types";
import {
  connectAcornSocket,
  getAcornSocket,
  isAcornSocketConnected,
  type AcornSocketHandlers,
} from "../acorn-socket";
import { broadcastOperatorNotice, socketErrorDetail } from "../operator-notice";
import { queueTabPipeline } from "../tab-pipeline-session";
import { MSG } from "../types";
import { bindSocketRelay } from "./socket-relay";

let socketErrorToastAt = 0;
const SOCKET_TOAST_MS = 12_000;
export const sidebarPorts = new Set<chrome.runtime.Port>();

export function broadcastPipelineProgress(tabId: number, progress: PipelineProgress): void {
  getAcornSocket()?.emit("pipeline:progress", { tabId, progress });
  void queueTabPipeline(tabId, progress);
  chrome.runtime.sendMessage({ type: MSG.PIPELINE_PROGRESS, tabId, progress }, () => {
    void chrome.runtime.lastError;
  });
}

function pushSocketStatus(connected: boolean): void {
  const message = { type: MSG.SOCKET_STATUS, connected };
  for (const port of sidebarPorts) {
    try {
      port.postMessage(message);
    } catch {
      sidebarPorts.delete(port);
    }
  }
}

export const socketHandlers: AcornSocketHandlers = {
  bindEvents: bindSocketRelay,
  onConnected: () => {
    const recovered = socketErrorToastAt > 0;
    pushSocketStatus(true);
    if (recovered) {
      socketErrorToastAt = 0;
      broadcastOperatorNotice({
        kind: "success",
        title: "Connected",
        detail: "Connected to Acorn.",
      });
    }
  },
  onDisconnected: () => {
    pushSocketStatus(false);
  },
  onConnectError: (err) => {
    if (isAcornSocketConnected()) return;
    pushSocketStatus(false);
    const now = Date.now();
    if (now - socketErrorToastAt < SOCKET_TOAST_MS) return;
    socketErrorToastAt = now;
    broadcastOperatorNotice({
      kind: "error",
      title: "Couldn’t connect",
      detail: socketErrorDetail(err.message),
    });
  },
};

export function connectSocket(): Promise<void> {
  return connectAcornSocket(socketHandlers);
}
