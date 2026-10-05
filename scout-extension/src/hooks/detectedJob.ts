import { parseCapturedJobResponse, type CapturedJob } from "../capture";
import { isTabNavigationMessage, RUNTIME_MESSAGE } from "../messaging/runtime";

export type DetectedJobState =
  { status: "loading" } | { status: "found"; job: CapturedJob } | { status: "empty" };

export function stateFromCapturedJob(job: CapturedJob | null): DetectedJobState {
  return job ? { status: "found", job } : { status: "empty" };
}

export function shouldRefreshDetectedJob(message: unknown): boolean {
  return isTabNavigationMessage(message);
}

export async function requestDetectedJob(
  send: (message: unknown) => Promise<unknown>,
): Promise<DetectedJobState> {
  try {
    const response = await send({ type: RUNTIME_MESSAGE.CAPTURE_TAB });
    return stateFromCapturedJob(parseCapturedJobResponse(response));
  } catch {
    return { status: "empty" };
  }
}
