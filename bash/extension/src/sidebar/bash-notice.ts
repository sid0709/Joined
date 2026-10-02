import type { BashNoticeKind, BashNoticePayload } from "../types";
import { flashFromNotice } from "../bash-face/face-flash";

export type BashNoticePhase = "in" | "out";

export type BashNotice = BashNoticePayload & {
  id: string;
  phase: BashNoticePhase;
};

type PushFn = (notice: BashNoticePayload) => void;

let pushImpl: PushFn | null = null;

/** Exit fade/slide. Must stay under 0.5s so the job list stays readable. */
export const NOTICE_EXIT_MS = 180;
/** Time on screen before exit, including enter. Errors stay up long enough to read debug detail. */
const NOTICE_HOLD_MS = {
  success: 3500,
  info: 5000,
  error: 12000,
} as const;

export function bindBashNoticePush(fn: PushFn): () => void {
  pushImpl = fn;
  return () => {
    if (pushImpl === fn) pushImpl = null;
  };
}

export function pushBashNotice(notice: BashNoticePayload): void {
  pushImpl?.(notice);
  flashFromNotice(notice.kind, notice.title);
}

export function noticeKindDuration(kind: BashNoticeKind): number {
  return NOTICE_HOLD_MS[kind];
}
