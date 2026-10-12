/**
 * Token-bucket rate limiter. `rate` is tokens per second (jobs/s). Capacity
 * defaults to 1 so a run cannot burst ahead of the steady rate at startup.
 */

export const DEFAULT_TOKEN_BUCKET_CAPACITY = 1;

export function createTokenBucket({
  rate,
  capacity = DEFAULT_TOKEN_BUCKET_CAPACITY,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const perSecond = Number(rate);
  const infinite = !Number.isFinite(perSecond) || perSecond === Infinity || perSecond <= 0;
  const max = Number.isFinite(capacity) && capacity > 0 ? capacity : DEFAULT_TOKEN_BUCKET_CAPACITY;
  let tokens = max;
  let last = now();

  function refill() {
    if (infinite) {
      tokens = max;
      last = now();
      return;
    }
    const current = now();
    const elapsed = Math.max(0, current - last) / 1000;
    tokens = Math.min(max, tokens + elapsed * perSecond);
    last = current;
  }

  async function take(count = 1) {
    const need = Number(count) > 0 ? Number(count) : 1;
    if (infinite) return;
    refill();
    while (tokens < need) {
      const waitMs = Math.ceil(((need - tokens) / perSecond) * 1000);
      await sleep(Math.max(1, waitMs));
      refill();
    }
    tokens -= need;
  }

  return {
    take,
    refill,
    get tokens() {
      refill();
      return tokens;
    },
    get rate() {
      return infinite ? Infinity : perSecond;
    },
    get capacity() {
      return max;
    },
  };
}
