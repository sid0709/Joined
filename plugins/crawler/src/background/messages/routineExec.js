import { hostMatches } from "../../routineKit/match.js";
import { ROUTINE_OP_ACTION } from "../../routineKit/protocol.js";
import { BUILTIN_HOSTS } from "../../routines/builtin/constants.js";
import { HIRINGCAFE_HOSTS } from "../../routines/hiringcafe/constants.js";
import { resolveTargetTab, sendToContentScript } from "../tabs.js";

import {
  clearFetchWatchInMainWorld,
  installFetchWatchInMainWorld,
  readFetchWatchInMainWorld,
} from "./fetchWatch.js";
import { abortInFlightNavigate, navigateTab } from "./navigateTab.js";
import { clickShadowInMainWorld } from "./shadowClick.js";

const FETCH_WATCH_OPS = new Set(["watchFetch", "watchedFetches", "unwatchFetch"]);

const defaultIo = {
  resolveTargetTab,
  sendToContentScript,
  navigateTab,
  abortInFlightNavigate,
  clickShadowInMainWorld,
  installFetchWatchInMainWorld,
  readFetchWatchInMainWorld,
  clearFetchWatchInMainWorld,
};

function shadowHosts(payload) {
  return payload?.hosts?.length ? payload.hosts : BUILTIN_HOSTS;
}

function isShadowHostAllowed(tabUrl, payload) {
  try {
    return hostMatches(new URL(tabUrl).hostname, shadowHosts(payload));
  } catch {
    return false;
  }
}

function isHiringCafeTab(tabUrl) {
  try {
    return hostMatches(new URL(tabUrl).hostname, HIRINGCAFE_HOSTS);
  } catch {
    return false;
  }
}

async function runFetchWatch(op, tab, payload, io) {
  if (op === "watchFetch") return io.installFetchWatchInMainWorld(tab.id, payload);
  if (op === "watchedFetches") return io.readFetchWatchInMainWorld(tab.id);
  return io.clearFetchWatchInMainWorld(tab.id);
}

// Side panel → background: run one routine op in the target tab and relay its response.
export function handleRoutineExec(message, sendResponse, io = defaultIo) {
  (async () => {
    const tab = await io.resolveTargetTab(message);
    if (!tab?.id) {
      sendResponse({ success: false, error: "No page tab found. Focus the site and try again." });
      return;
    }
    const op = message.payload?.op;
    if (op === "abortFetches") {
      io.abortInFlightNavigate();
    }
    if (op === "navigate") {
      const result = await io.navigateTab(tab.id, message.payload.url, message.payload.timeout);
      sendResponse({ success: true, result });
      return;
    }
    if (FETCH_WATCH_OPS.has(op)) {
      if (!isHiringCafeTab(tab.url)) {
        sendResponse({ success: false, error: "Fetch watch is limited to HiringCafe" });
        return;
      }
      const result = await runFetchWatch(op, tab, message.payload, io);
      sendResponse({ success: true, result });
      return;
    }
    if (op === "shadow") {
      if (!isShadowHostAllowed(tab.url, message.payload)) {
        sendResponse({ success: false, error: "Shadow ops are limited to Built In" });
        return;
      }
      if (message.payload?.action === "click") {
        try {
          const result = await io.clickShadowInMainWorld(tab.id, message.payload);
          sendResponse({ success: true, result });
          return;
        } catch (error) {
          console.warn("MAIN-world heart click failed; falling back to the isolated world", error);
        }
      }
    }
    const response = await io.sendToContentScript(tab.id, {
      action: ROUTINE_OP_ACTION,
      payload: message.payload,
    });
    sendResponse(response ?? { success: false, error: "The page did not answer the routine op" });
  })().catch((error) => sendResponse({ success: false, error: String(error?.message || error) }));
}
