import { captureJob } from "../capture/capture";
import type { PageRoot } from "../capture/page";
import type { CapturedJob } from "../capture/types";
import { isCaptureJobRequest } from "../messaging/runtime";

export const CAPTURE_BOUND_FLAG = "__scoutJobCaptureBound";

export function answerCaptureRequest(
  message: unknown,
  root: PageRoot,
  pageUrl: string,
): { job: CapturedJob | null } | null {
  if (!isCaptureJobRequest(message)) {
    return null;
  }
  return { job: captureJob(root, pageUrl) };
}

export interface CaptureListenerScope {
  window?: Record<string, unknown>;
  chrome?: Pick<typeof chrome, "runtime">;
  document?: PageRoot;
  location?: { href: string };
}

export function bindCaptureListener(scope: CaptureListenerScope = {}): boolean {
  const flagHolder =
    scope.window ?? (globalThis as unknown as { window?: Record<string, unknown> }).window;
  if (flagHolder?.[CAPTURE_BOUND_FLAG]) {
    return false;
  }
  if (flagHolder) {
    flagHolder[CAPTURE_BOUND_FLAG] = true;
  }

  const runtime = (scope.chrome ?? (globalThis as { chrome?: typeof chrome }).chrome)?.runtime;
  if (!runtime?.onMessage) {
    return false;
  }

  runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const page = scope.document ?? document;
    const pageUrl = scope.location?.href ?? location.href;
    const answer = answerCaptureRequest(message, page, pageUrl);
    if (!answer) {
      return;
    }
    sendResponse(answer);
  });
  return true;
}

bindCaptureListener();
