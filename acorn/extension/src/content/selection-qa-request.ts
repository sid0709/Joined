import { MSG } from "../types";

export function requestSelectionQa(
  question: string,
): Promise<{ ok: boolean; answer?: string; error?: string }> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        {
          type: MSG.SELECTION_QA,
          question,
          title: document.title,
          url: location.href,
        },
        (res: { ok?: boolean; answer?: string; error?: string } | undefined) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: "Acorn is unavailable on this page." });
            return;
          }
          resolve({
            ok: Boolean(res?.ok),
            answer: res?.answer,
            error: res?.error,
          });
        },
      );
    } catch {
      resolve({ ok: false, error: "Acorn is unavailable on this page." });
    }
  });
}
