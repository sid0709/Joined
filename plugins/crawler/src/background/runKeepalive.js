/* global chrome */

import { listBoundTabs } from "./boundTab.js";

export const RUN_KEEPALIVE_PORT = "routine:keepalive";
export const RUN_KEEPALIVE_ALARM = "crawlerRunKeepalive";
export const RUN_KEEPALIVE_PERIOD_MINUTES = 1;

const ports = new Set();

export function resetRunKeepalive() {
  ports.clear();
}

export function keepalivePortCount() {
  return ports.size;
}

export function startRunKeepalive(alarms = globalThis.chrome?.alarms) {
  if (typeof alarms?.create !== "function") return { armed: false };
  void alarms.create(RUN_KEEPALIVE_ALARM, { periodInMinutes: RUN_KEEPALIVE_PERIOD_MINUTES });
  return { armed: true };
}

export function stopRunKeepaliveIfIdle(alarms = globalThis.chrome?.alarms, boundCount = 0) {
  if (typeof alarms === "number") {
    boundCount = alarms;
    alarms = globalThis.chrome?.alarms;
  }
  if (ports.size > 0 || boundCount > 0) return { cleared: false };
  if (typeof alarms?.clear === "function") void alarms.clear(RUN_KEEPALIVE_ALARM);
  return { cleared: true };
}

export function handleKeepaliveConnect(port) {
  if (port?.name !== RUN_KEEPALIVE_PORT) return false;
  ports.add(port);
  startRunKeepalive();
  port.onDisconnect.addListener(() => {
    ports.delete(port);
    stopRunKeepaliveIfIdle(undefined, listBoundTabs().length);
  });
  return true;
}

export function handleKeepaliveAlarm(alarm) {
  return alarm?.name === RUN_KEEPALIVE_ALARM;
}
