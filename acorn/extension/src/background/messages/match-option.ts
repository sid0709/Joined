import { authHeaders, getAcornApiUrl } from "../../auth/acorn-auth";
import { matchOptionViaAnalyze } from "../../pipeline/match-option-analyze";
import { addPipelineUsage } from "../../pipeline/usage-tracker";
import type { MatchOptionRequest, MatchOptionResponse } from "../../types";
import { pipelineRunningTabIds } from "../work-state";
import type { RuntimeMessage, SendResponse } from "./shared";

export function handleMatchOption(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
): void {
  const incoming = message.payload as MatchOptionRequest;
  const usageTabId = sender.tab?.id;
  (async () => {
    try {
      const base = await getAcornApiUrl();
      const payload: Record<string, unknown> = {
        intendedValue: incoming.intendedValue,
        options: incoming.options.filter(
          (opt): opt is string => typeof opt === "string" && opt.trim().length > 0,
        ),
      };
      if (typeof incoming.fieldLabel === "string" && incoming.fieldLabel.trim()) {
        payload.fieldLabel = incoming.fieldLabel;
      }
      if (typeof incoming.typedQuery === "string" && incoming.typedQuery.trim()) {
        payload.typedQuery = incoming.typedQuery;
      }
      const res = await fetch(`${base}/acorn/match-option`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as MatchOptionResponse;
      if (!res.ok) {
        sendResponse({
          ok: false,
          matched_option: null,
          error: data.error || `match-option failed: ${res.status}`,
        } satisfies MatchOptionResponse);
        return;
      }
      if (usageTabId != null && pipelineRunningTabIds.has(usageTabId) && data.usage) {
        addPipelineUsage(usageTabId, data.usage);
      }
      let reply: MatchOptionResponse = { ...data, ok: data.ok !== false };
      const listed = (payload.options as string[]) || [];
      let fromAnalyze: string | null = null;
      if (reply.ok && !reply.matched_option && listed.length) {
        fromAnalyze = await matchOptionViaAnalyze({
          intendedValue: String(incoming.intendedValue || ""),
          options: listed,
          fieldLabel: typeof incoming.fieldLabel === "string" ? incoming.fieldLabel : "",
          apiUrl: base,
        }).catch(() => null);
        if (fromAnalyze) {
          reply = { ...reply, matched_option: fromAnalyze, ok: true };
        }
      }
      sendResponse(reply);
    } catch (err) {
      sendResponse({
        ok: false,
        matched_option: null,
        error: err instanceof Error ? err.message : String(err),
      } satisfies MatchOptionResponse);
    }
  })();
}
