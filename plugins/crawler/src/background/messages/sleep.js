/* global chrome */

export function sleepMs(ms, timers = {}) {
  const delay = Math.max(0, Number(ms) || 0);
  if (delay === 0) return Promise.resolve();
  const setTimer = timers.setTimeout ?? setTimeout;
  return new Promise((resolve) => {
    setTimer(resolve, delay);
  });
}

export async function handleSleep(payload = {}, timers = {}) {
  await sleepMs(payload.ms, timers);
  return { slept: true, ms: Math.max(0, Number(payload.ms) || 0) };
}

export const defaultSleepTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
};
