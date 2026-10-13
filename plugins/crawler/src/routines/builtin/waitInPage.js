import { BUILTIN_WAIT_OP } from "./constants.js";

function isStopError(error) {
  return error?.name === "RoutineStoppedError" || error?.name === "AbortError";
}

/**
 * One `builtinWait` round trip: the page watches the DOM and answers as soon as
 * `until` holds (or with its last state after `timeoutMs`). Null when the page could
 * not answer — an older content script, or the document navigated away mid-wait —
 * so the caller falls back to its poll loop.
 */
export async function waitInPage(call, until, payload, timeoutMs) {
  try {
    const result = await call(BUILTIN_WAIT_OP, { ...payload, until, timeoutMs }, timeoutMs);
    return result?.until === until ? result : null;
  } catch (error) {
    if (isStopError(error)) throw error;
    return null;
  }
}
