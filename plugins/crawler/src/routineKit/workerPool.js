/**
 * Bounded worker pool. `getConcurrency` is read before each start so backoff can
 * shrink or grow the number of in-flight tasks. Aborting `signal` rejects queued
 * work and stops starting new tasks.
 */

function stoppedError() {
  const error = new Error("Routine stopped");
  error.name = "RoutineStoppedError";
  return error;
}

export function createWorkerPool({ getConcurrency, signal } = {}) {
  let active = 0;
  const queued = [];
  let closed = false;

  function limit() {
    const value = Number(typeof getConcurrency === "function" ? getConcurrency() : getConcurrency);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
  }

  function isAborted() {
    return closed || Boolean(signal?.aborted);
  }

  function pump() {
    while (!isAborted() && active < limit() && queued.length) {
      const task = queued.shift();
      active += 1;
      Promise.resolve()
        .then(() => {
          if (isAborted()) throw stoppedError();
          return task.fn();
        })
        .then(task.resolve, task.reject)
        .finally(() => {
          active -= 1;
          pump();
        });
    }
    if (isAborted()) {
      while (queued.length) queued.shift().reject(stoppedError());
    }
  }

  if (signal) {
    signal.addEventListener("abort", () => pump(), { once: true });
  }

  return {
    get active() {
      return active;
    },
    get pending() {
      return queued.length;
    },
    run(fn) {
      return new Promise((resolve, reject) => {
        if (isAborted()) {
          reject(stoppedError());
          return;
        }
        queued.push({ fn, resolve, reject });
        pump();
      });
    },
    close() {
      closed = true;
      pump();
    },
  };
}
