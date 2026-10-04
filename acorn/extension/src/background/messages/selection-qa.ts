import { getAcornSession } from "../../auth/acorn-auth";
import { requestQaAnswer } from "../../pipeline/api/qa";
import { getTabJob } from "../../tab-job-session";
import type { RuntimeMessage, SendResponse } from "./shared";

export function handleSelectionQa(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
): void {
  void (async () => {
    try {
      const session = await getAcornSession();
      if (!session) {
        sendResponse({ ok: false, error: "Sign in to Acorn" });
        return;
      }
      const question = String(message.question || "").trim();
      if (!question) {
        sendResponse({ ok: false, error: "Select some text first." });
        return;
      }
      const tabId = sender.tab?.id;
      const tabJob = typeof tabId === "number" ? await getTabJob(tabId) : null;
      const answer = await requestQaAnswer({
        question,
        page: {
          title: String(message.title || ""),
          url: String(message.url || ""),
          job: tabJob
            ? {
                id: tabJob.jobId,
                title: tabJob.title,
                company: tabJob.company,
              }
            : null,
        },
      });
      sendResponse({ ok: true, answer });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      sendResponse({
        ok: false,
        error: /sign in/i.test(detail) ? "Sign in to Acorn" : detail,
      });
    }
  })();
}
