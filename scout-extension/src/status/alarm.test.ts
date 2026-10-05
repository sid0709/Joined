import { describe, expect, test } from "bun:test";

import {
  STATUS_POLL_ALARM,
  STATUS_POLL_PERIOD_MINUTES,
  chromeAlarmPort,
  ensureStatusPollAlarm,
  isStatusPollAlarm,
} from "./alarm";

describe("status poll alarm", () => {
  test("creates the repeating alarm once", async () => {
    const created: Array<{ name: string; periodInMinutes?: number }> = [];
    const port = {
      async get(name: string) {
        return created.find((alarm) => alarm.name === name) as chrome.alarms.Alarm | undefined;
      },
      async create(name: string, info: chrome.alarms.AlarmCreateInfo) {
        created.push({ name, periodInMinutes: info.periodInMinutes });
      },
    };

    await ensureStatusPollAlarm(port);
    await ensureStatusPollAlarm(port);

    expect(created).toEqual([
      { name: STATUS_POLL_ALARM, periodInMinutes: STATUS_POLL_PERIOD_MINUTES },
    ]);
    expect(isStatusPollAlarm({ name: STATUS_POLL_ALARM })).toBe(true);
    expect(isStatusPollAlarm({ name: "other" })).toBe(false);
  });

  test("chromeAlarmPort returns chrome.alarms", () => {
    const alarms = {
      async get() {
        return undefined;
      },
      async create() {
        return;
      },
    };
    (globalThis as unknown as { chrome: { alarms: typeof alarms } }).chrome = { alarms };
    expect(chromeAlarmPort()).toBe(alarms);
  });
});
