import { io, type Socket } from "socket.io-client";
import {
  acornSocketOrigin,
  getAccessToken,
  getAcornApiUrl,
  ACORN_SOCKET_PATH,
} from "./auth/acorn-auth";

export type AcornSocketHandlers = {
  onConnected: () => void;
  onDisconnected: () => void;
  onConnectError: (err: Error) => void;
  bindEvents: (socket: Socket) => void;
};

let socket: Socket | null = null;
let generation = 0;
let identity = "";
let inFlight = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function getAcornSocket(): Socket | null {
  return socket;
}

export function isAcornSocketConnected(): boolean {
  return Boolean(socket?.connected);
}

export async function connectAcornSocket(handlers: AcornSocketHandlers): Promise<void> {
  const token = await getAccessToken();
  const origin = acornSocketOrigin(await getAcornApiUrl());
  const nextIdentity = token ? `${origin}|${token}` : "";

  if (!token) {
    generation += 1;
    identity = "";
    inFlight = false;
    teardown();
    handlers.onDisconnected();
    return;
  }

  if (identity === nextIdentity && socket && (socket.connected || socket.active || inFlight)) {
    return;
  }

  const gen = ++generation;
  inFlight = true;
  teardown();

  const next = io(origin, {
    path: ACORN_SOCKET_PATH,
    auth: { token },
    query: { type: "extension", name: "Acorn Extension" },
    transports: ["websocket", "polling"],
    upgrade: true,
    tryAllTransports: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 8_000,
    timeout: 20_000,
    withCredentials: false,
  });

  socket = next;
  identity = nextIdentity;
  handlers.bindEvents(next);

  next.on("connect", () => {
    if (gen !== generation || socket !== next) return;
    inFlight = false;
    handlers.onConnected();
  });
  next.on("disconnect", () => {
    if (gen !== generation || socket !== next) return;
    inFlight = false;
    handlers.onDisconnected();
  });
  next.on("connect_error", (err) => {
    if (gen !== generation || socket !== next) return;
    inFlight = false;
    // Websocket probes can 400 until host nginx upgrades /acorn/socket.io; polling may still be live.
    if (next.connected) return;
    handlers.onConnectError(err instanceof Error ? err : new Error(String(err)));
  });
}

export function scheduleConnectAcornSocket(handlers: AcornSocketHandlers, delayMs = 200): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void connectAcornSocket(handlers);
  }, delayMs);
}

function teardown(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
