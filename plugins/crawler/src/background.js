/* global chrome */
import { SCRAPE_QUEUE_ALARM } from "./api/scrapeQueue.js";
import { BOUND_TAB_CLOSED_MESSAGE } from "./background/boundTab.js";
import { loadJobBidStore } from "./background/jobBidStore.js";
import { routeMessage } from "./background/messageRouter.js";
import { handleBoundTabRemoved } from "./background/messages/bindTab.js";
import { releaseDebugger } from "./background/messages/debuggerMouse.js";
import { abortInFlightNavigate } from "./background/messages/navigateTab.js";
import {
  handleKeepaliveAlarm,
  handleKeepaliveConnect,
  stopRunKeepaliveIfIdle,
} from "./background/runKeepalive.js";
import { drainScrapeQueue, startScrapeQueue } from "./background/scrapeQueueWorker.js";
import { persistJobApiUrlToStorage, persistSpiritApiUrlToStorage } from "./config/env.js";
import { ROUTINE_TAB_CLOSED_ACTION } from "./routineKit/protocol.js";

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

loadJobBidStore();
persistSpiritApiUrlToStorage();
persistJobApiUrlToStorage();
startScrapeQueue();

chrome.runtime.onConnect.addListener((port) => {
  handleKeepaliveConnect(port);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const bind = handleBoundTabRemoved(tabId, {
    releaseDebugger,
    abortInFlightNavigate,
    stopKeepalive: stopRunKeepaliveIfIdle,
  });
  if (!bind) return;
  chrome.runtime
    .sendMessage({
      action: ROUTINE_TAB_CLOSED_ACTION,
      tabId,
      payload: { tabId, routineId: bind.routineId, message: BOUND_TAB_CLOSED_MESSAGE },
    })
    .catch(() => {});
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm?.name === SCRAPE_QUEUE_ALARM) void drainScrapeQueue();
  handleKeepaliveAlarm(alarm);
});

chrome.runtime.onMessage.addListener(routeMessage);
