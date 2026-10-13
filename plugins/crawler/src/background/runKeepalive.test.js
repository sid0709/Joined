import { beforeEach, describe, expect, test } from "bun:test";

import { resetBoundTabs } from "./boundTab.js";
import {
  RUN_KEEPALIVE_ALARM,
  RUN_KEEPALIVE_PERIOD_MINUTES,
  RUN_KEEPALIVE_PORT,
  handleKeepaliveAlarm,
  handleKeepaliveConnect,
  keepalivePortCount,
  resetRunKeepalive,
  startRunKeepalive,
  stopRunKeepaliveIfIdle,
} from "./runKeepalive.js";

beforeEach(() => {
  resetRunKeepalive();
  resetBoundTabs();
});

function alarmsIo() {
  const calls = [];
  return {
    calls,
    create: (name, info) => calls.push(["create", name, info]),
    clear: (name) => calls.push(["clear", name]),
  };
}

describe("run keepalive", () => {
  test("arms a one-minute alarm", () => {
    const alarms = alarmsIo();
    expect(startRunKeepalive(alarms)).toEqual({ armed: true });
    expect(alarms.calls).toEqual([
      ["create", RUN_KEEPALIVE_ALARM, { periodInMinutes: RUN_KEEPALIVE_PERIOD_MINUTES }],
    ]);
    expect(startRunKeepalive({})).toEqual({ armed: false });
  });

  test("clears the alarm when a number is passed where alarms were expected", () => {
    const alarms = alarmsIo();
    globalThis.chrome = { alarms };
    expect(stopRunKeepaliveIfIdle(0)).toEqual({ cleared: true });
    expect(alarms.calls).toEqual([["clear", RUN_KEEPALIVE_ALARM]]);
    delete globalThis.chrome;
  });

  test("keeps the alarm while a panel port or bind is live", () => {
    const alarms = alarmsIo();
    globalThis.chrome = { alarms };
    const listeners = [];
    const port = {
      name: RUN_KEEPALIVE_PORT,
      onDisconnect: { addListener: (fn) => listeners.push(fn) },
    };
    expect(handleKeepaliveConnect({ name: "other" })).toBe(false);
    expect(handleKeepaliveConnect(port)).toBe(true);
    expect(keepalivePortCount()).toBe(1);
    expect(stopRunKeepaliveIfIdle(alarms, 1)).toEqual({ cleared: false });
    listeners[0]();
    expect(keepalivePortCount()).toBe(0);
    expect(stopRunKeepaliveIfIdle(undefined, 0)).toEqual({ cleared: true });
    expect(alarms.calls.some((call) => call[0] === "clear")).toBe(true);
    delete globalThis.chrome;
  });

  test("clears the alarm on panel disconnect when no tabs are bound", () => {
    const alarms = alarmsIo();
    globalThis.chrome = { alarms };
    const listeners = [];
    const port = {
      name: RUN_KEEPALIVE_PORT,
      onDisconnect: { addListener: (fn) => listeners.push(fn) },
    };
    expect(handleKeepaliveConnect(port)).toBe(true);
    expect(keepalivePortCount()).toBe(1);
    listeners[0]();
    expect(keepalivePortCount()).toBe(0);
    expect(alarms.calls).toContainEqual(["clear", RUN_KEEPALIVE_ALARM]);
    delete globalThis.chrome;
  });

  test("recognizes the keepalive alarm", () => {
    expect(handleKeepaliveAlarm({ name: RUN_KEEPALIVE_ALARM })).toBe(true);
    expect(handleKeepaliveAlarm({ name: "other" })).toBe(false);
  });
});
