import type { AcornNoticeKind, AcornNoticePayload } from "../types";
import { flashFromNotice } from "../acorn-face/face-flash";

type PushFn = (notice: AcornNoticePayload) => void;

let pushImpl: PushFn | null = null;

/** Time on screen. Errors stay up long enough to read debug detail. */
const NOTICE_HOLD_MS = {
  success: 3500,
  info: 5000,
  error: 12000,
} as const;

export function bindAcornNoticePush(fn: PushFn): () => void {
  pushImpl = fn;
  return () => {
    if (pushImpl === fn) pushImpl = null;
  };
}

export function pushAcornNotice(notice: AcornNoticePayload): void {
  pushImpl?.(notice);
  flashFromNotice(notice.kind, notice.title);
}

export function noticeKindDuration(kind: AcornNoticeKind): number {
  return NOTICE_HOLD_MS[kind];
}
