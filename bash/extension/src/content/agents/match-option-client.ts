import { MSG, type MatchOptionRequest, type MatchOptionResponse } from "../../types";

/** Ask ai-backend (via service worker) which visible option matches the intended value. */
export async function askAiMatchOption(request: MatchOptionRequest): Promise<MatchOptionResponse> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        { type: MSG.MATCH_OPTION, payload: request },
        (response: MatchOptionResponse | undefined) => {
          if (chrome.runtime.lastError) {
            resolve({
              ok: false,
              matched_option: null,
              error: chrome.runtime.lastError.message,
            });
            return;
          }
          resolve(response ?? { ok: false, matched_option: null, error: "No response" });
        },
      );
    } catch (err) {
      resolve({
        ok: false,
        matched_option: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
