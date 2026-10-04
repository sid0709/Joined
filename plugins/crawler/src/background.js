/* global chrome */
import { SCRAPE_QUEUE_ALARM } from "./api/scrapeQueue.js";
import { loadJobBidStore } from "./background/jobBidStore.js";
import { routeMessage } from "./background/messageRouter.js";
import { drainScrapeQueue, startScrapeQueue } from "./background/scrapeQueueWorker.js";
import { persistJobApiUrlToStorage, persistSpiritApiUrlToStorage } from "./config/env.js";

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

loadJobBidStore();
persistSpiritApiUrlToStorage();
persistJobApiUrlToStorage();
startScrapeQueue();

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm?.name === SCRAPE_QUEUE_ALARM) void drainScrapeQueue();
});

chrome.runtime.onMessage.addListener(routeMessage);
