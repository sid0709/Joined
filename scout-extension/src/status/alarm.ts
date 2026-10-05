export const STATUS_POLL_ALARM = "scout.status-poll";
export const STATUS_POLL_PERIOD_MINUTES = 1;

export interface AlarmPort {
  get(name: string): Promise<chrome.alarms.Alarm | undefined>;
  create(name: string, info: chrome.alarms.AlarmCreateInfo): Promise<void>;
}

export function chromeAlarmPort(): AlarmPort {
  return chrome.alarms;
}

export async function ensureStatusPollAlarm(port: AlarmPort): Promise<void> {
  const existing = await port.get(STATUS_POLL_ALARM);
  if (existing) {
    return;
  }
  await port.create(STATUS_POLL_ALARM, { periodInMinutes: STATUS_POLL_PERIOD_MINUTES });
}

export function isStatusPollAlarm(alarm: Pick<chrome.alarms.Alarm, "name">): boolean {
  return alarm.name === STATUS_POLL_ALARM;
}
