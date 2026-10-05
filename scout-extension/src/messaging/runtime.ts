export const RUNTIME_MESSAGE = {
  TAB_CLOSED: "tab-closed",
  TAB_UPDATED: "tab-updated",
  TAB_ACTIVATED: "tab-activated",
  CAPTURE_TAB: "capture-tab",
  CAPTURE_JOB: "capture-job",
} as const;

export type RuntimeMessageType = (typeof RUNTIME_MESSAGE)[keyof typeof RUNTIME_MESSAGE];

export const CAPTURE_TIMEOUT_MS = 4000;
export const CAPTURE_TIMEOUT_MESSAGE = "job capture timed out";

function messageType(message: unknown): string | null {
  if (typeof message !== "object" || message === null || !("type" in message)) {
    return null;
  }
  return typeof message.type === "string" ? message.type : null;
}

export function isCaptureTabRequest(message: unknown): boolean {
  return messageType(message) === RUNTIME_MESSAGE.CAPTURE_TAB;
}

export function isCaptureJobRequest(message: unknown): boolean {
  return messageType(message) === RUNTIME_MESSAGE.CAPTURE_JOB;
}

export function isTabNavigationMessage(message: unknown): boolean {
  const type = messageType(message);
  return type === RUNTIME_MESSAGE.TAB_UPDATED || type === RUNTIME_MESSAGE.TAB_ACTIVATED;
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = CAPTURE_TIMEOUT_MESSAGE,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
