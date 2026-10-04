import { sendTabMessage } from "../tab-messaging";
import { MSG, type DomTreePayload } from "../types";

const DOM_FETCH_DETAIL_FRAMES = 8;

type DomFrameAttempt = {
  frameId: number;
  parentFrameId: number | null;
  host: string;
  outcome: "ok" | "skipped" | "no-tree" | "error";
  formScore: number | null;
  error: string | null;
};

function frameHost(url?: string): string {
  try {
    return url ? new URL(url).host : "?";
  } catch {
    return "?";
  }
}

function formatDomFetchFailure(tabId: number, attempts: DomFrameAttempt[]): string {
  const lines = [
    `Could not fetch DOM from any frame (tab ${tabId}, ${attempts.length} frame${
      attempts.length === 1 ? "" : "s"
    }).`,
  ];
  const shown = attempts.slice(0, DOM_FETCH_DETAIL_FRAMES);
  for (const row of shown) {
    const score = row.formScore == null ? "" : ` score=${row.formScore}`;
    const err = row.error ? ` — ${row.error}` : "";
    const parent = row.parentFrameId == null ? "" : ` parent=${row.parentFrameId}`;
    lines.push(`frame ${row.frameId}${parent} ${row.host}: ${row.outcome}${score}${err}`);
  }
  if (attempts.length > shown.length) {
    lines.push(`… ${attempts.length - shown.length} more frames`);
  }
  const unreachable = attempts.every(
    (row) =>
      row.outcome === "error" &&
      /could not establish connection|receiving end does not exist/i.test(row.error || ""),
  );
  lines.push(
    unreachable
      ? "No content script answered. Reload the Acorn extension, then refresh this page."
      : "Reload the Acorn extension and refresh the page.",
  );
  return lines.join("\n");
}

export async function fetchDomFromTab(
  tabId: number,
  preferredFrameId?: number | null,
): Promise<DomTreePayload> {
  const tried = new Set<number>();

  const attempt = async (frameId?: number) => {
    if (frameId != null) {
      if (tried.has(frameId)) return null;
      tried.add(frameId);
    }
    return sendTabMessage<
      DomTreePayload & { error?: string; skipped?: boolean; formScore?: number }
    >(tabId, { type: MSG.FETCH_DOM }, frameId);
  };

  type Candidate = DomTreePayload & { formScore: number };
  const candidates: Candidate[] = [];
  const attempts: DomFrameAttempt[] = [];

  const consider = (
    res: (DomTreePayload & { error?: string; skipped?: boolean; formScore?: number }) | null,
    frameId: number,
    parentFrameId: number | null,
    listedUrl?: string,
  ) => {
    const host = frameHost(res?.url || listedUrl);
    const formScore = typeof res?.formScore === "number" ? res.formScore : null;
    const error = res?.error ? String(res.error) : null;
    if (res?.tree && !res.error) {
      attempts.push({
        frameId,
        parentFrameId,
        host,
        outcome: "ok",
        formScore: typeof res.formScore === "number" ? res.formScore : 0,
        error: null,
      });
      candidates.push({
        ...res,
        tabId,
        frameId,
        formScore: typeof res.formScore === "number" ? res.formScore : 0,
      });
      return;
    }
    attempts.push({
      frameId,
      parentFrameId,
      host,
      outcome: res?.skipped ? "skipped" : error ? "error" : "no-tree",
      formScore,
      error,
    });
  };

  let frameList: Array<{ frameId: number; url?: string; parentFrameId?: number }> = [
    { frameId: 0 },
  ];
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    if (frames?.length) {
      frameList = frames.map((f) => ({
        frameId: f.frameId,
        url: f.url,
        parentFrameId: f.parentFrameId,
      }));
    }
  } catch {
    // restricted pages — fall back to main frame only
  }

  if (preferredFrameId != null) {
    consider(await attempt(preferredFrameId), preferredFrameId, null);
  }
  for (const frame of frameList) {
    const res = await attempt(frame.frameId);
    if (res == null) continue;
    consider(res, frame.frameId, frame.parentFrameId ?? null, frame.url);
  }

  if (!candidates.length) {
    throw new Error(formatDomFetchFailure(tabId, attempts));
  }

  candidates.sort((a, b) => {
    if (b.formScore !== a.formScore) return b.formScore - a.formScore;
    if (a.frameId === preferredFrameId) return -1;
    if (b.frameId === preferredFrameId) return 1;
    // Prefer nested frames over shell when scores tie.
    return (b.frameId ?? 0) - (a.frameId ?? 0);
  });

  const picked = candidates[0];
  return picked;
}
