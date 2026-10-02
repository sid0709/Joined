import { MSG } from "./types";

const SEND_TIMEOUT_MS = 20000;
/** Plan steps may wait on option matching; 20s aborted those clicks mid-run. */
const PLAN_STEP_TIMEOUT_MS = 120000;

export function sendTabMessage<T = unknown>(
  tabId: number,
  message: unknown,
  frameId?: number,
  timeoutMs = SEND_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      finish({
        ok: false,
        error: `Content script timed out after ${timeoutMs}ms`,
      } as T);
    }, timeoutMs);

    const options = frameId == null ? undefined : { frameId };

    try {
      chrome.tabs.sendMessage(tabId, message, options as chrome.tabs.MessageSendOptions, (res) => {
        if (chrome.runtime.lastError) {
          finish({
            ok: false,
            error: chrome.runtime.lastError.message,
          } as T);
          return;
        }
        finish((res ?? { ok: false, error: "No response from page" }) as T);
      });
    } catch (err) {
      finish({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      } as T);
    }
  });
}

/** Prefer a known frame, then try every frame until one returns a real plan-step result. */
export async function sendPlanStepToTab(
  tabId: number,
  step: unknown,
  preferredFrameId?: number | null,
): Promise<{
  ok: boolean;
  verified?: boolean;
  acted?: boolean;
  alreadyFilled?: boolean;
  error?: string;
  details?: Record<string, unknown>;
}> {
  const message = { type: MSG.PLAN_STEP, step };
  const tried = new Set<number>();

  const attempt = async (frameId?: number) => {
    if (frameId != null) {
      if (tried.has(frameId)) return null;
      tried.add(frameId);
    }
    return sendTabMessage<{
      ok: boolean;
      verified?: boolean;
      acted?: boolean;
      alreadyFilled?: boolean;
      error?: string;
      details?: Record<string, unknown>;
      /** Frame routing only: this content script is not the form frame. */
      skipped?: boolean;
    }>(tabId, message, frameId, PLAN_STEP_TIMEOUT_MS);
  };

  if (preferredFrameId != null) {
    const preferred = await attempt(preferredFrameId);
    if (preferred && !preferred.skipped && !isUnreachable(preferred.error)) {
      return preferred;
    }
  }

  // Main frame
  const main = await attempt(0);
  if (main && !main.skipped && !isUnreachable(main.error)) {
    return main;
  }

  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    for (const frame of frames ?? []) {
      const res = await attempt(frame.frameId);
      if (!res || res.skipped || isUnreachable(res.error)) continue;
      return res;
    }
  } catch {
    // webNavigation may fail on restricted pages
  }

  return {
    ok: false,
    error:
      main?.error ||
      "No content-script frame answered plan-step. Reload the Acorn extension and refresh the page.",
  };
}

function isUnreachable(error?: string): boolean {
  if (!error) return false;
  return /could not establish connection|receiving end does not exist|port closed/i.test(error);
}
