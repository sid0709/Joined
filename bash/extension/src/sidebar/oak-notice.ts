import type { OakNoticeKind, OakNoticePayload } from "../types";
import { flashFromNotice } from "../oak-face/face-flash";

export type OakNoticePhase = "in" | "out";

export type OakNotice = OakNoticePayload & {
  id: string;
  phase: OakNoticePhase;
};

type PushFn = (notice: OakNoticePayload) => void;

let pushImpl: PushFn | null = null;

/** Exit fade/slide. Must stay under 0.5s so the job list stays readable. */
export const NOTICE_EXIT_MS = 180;
/** Time on screen before exit, including enter. Errors stay up long enough to read debug detail. */
const NOTICE_HOLD_MS = {
  success: 3500,
  info: 5000,
  error: 12000,
} as const;

export function bindOakNoticePush(fn: PushFn): () => void {
  pushImpl = fn;
  return () => {
    if (pushImpl === fn) pushImpl = null;
  };
}

export function pushOakNotice(notice: OakNoticePayload): void {
  pushImpl?.(notice);
  flashFromNotice(notice.kind, notice.title);
}

export function noticeKindDuration(kind: OakNoticeKind): number {
  return NOTICE_HOLD_MS[kind];
}
