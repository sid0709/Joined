import { meSend } from "@/lib/me/client";

/** What a hunter did with a ranked result. Applies weigh most when the ranker learns. */
export type RankingEventType = "click" | "save" | "apply" | "dismiss";

/**
 * Tells the server how a ranked result was used, so later rankings can learn from
 * it. Fire and forget: a lost event never blocks or breaks the page.
 */
export function logRankingEvent(
  rankingId: string | undefined,
  jobId: string,
  type: RankingEventType,
  position: number,
) {
  if (!rankingId || position < 0) return;
  void meSend("/ranking/events", "POST", { rankingId, jobId, type, position }).catch(() => {});
}
