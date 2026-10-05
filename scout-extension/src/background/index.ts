import { ScoutApiClient } from "../api";
import { getSessionCookieName } from "../api/config";
import {
  applyToolbarBadge,
  chromeToolbarBadgePort,
  toolbarBadgeAppearance,
  type BadgeAuthStatus,
} from "../badge";
import captureScript from "../content/capture?script&iife";
import { chromeLocalStore } from "../drafts";
import { isCaptureTabRequest, isPollStatusRequest, RUNTIME_MESSAGE } from "../messaging/runtime";
import {
  chromeAlarmPort,
  chromeDesktopNotificationPort,
  draftsFromStorageChange,
  ensureStatusPollAlarm,
  isStatusPollAlarm,
  pollSubmissionStatus,
  showDesktopNotification,
} from "../status";

import { handleCaptureTabRequest } from "./capture-tab";

console.log("Scout background service worker initialized");

const client = new ScoutApiClient();
const store = chromeLocalStore();
const badgePort = chromeToolbarBadgePort();
const notificationPort = chromeDesktopNotificationPort();

let lastAuth: BadgeAuthStatus = "loading";
let pollInFlight = false;

async function applyBadge(appearance: Parameters<typeof applyToolbarBadge>[0]): Promise<void> {
  await applyToolbarBadge(appearance, badgePort);
}

async function runStatusPoll(): Promise<void> {
  if (pollInFlight) {
    return;
  }
  pollInFlight = true;
  try {
    lastAuth = await pollSubmissionStatus(client, store, {
      applyBadge,
      showNotification: (item, id) => showDesktopNotification(item, id, notificationPort),
    });
  } finally {
    pollInFlight = false;
  }
}

async function refreshBadgeFromDrafts(
  drafts: Parameters<typeof toolbarBadgeAppearance>[1],
): Promise<void> {
  await applyBadge(toolbarBadgeAppearance(lastAuth, drafts));
}

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);

void ensureStatusPollAlarm(chromeAlarmPort());
void runStatusPoll();

chrome.runtime.onInstalled.addListener(() => {
  void ensureStatusPollAlarm(chromeAlarmPort());
  void runStatusPoll();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureStatusPollAlarm(chromeAlarmPort());
  void runStatusPoll();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (isStatusPollAlarm(alarm)) {
    void runStatusPoll();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  const drafts = draftsFromStorageChange(changes, area);
  if (drafts) {
    void refreshBadgeFromDrafts(drafts);
  }
});

chrome.cookies.onChanged.addListener((change) => {
  if (change.cookie.name === getSessionCookieName()) {
    void runStatusPoll();
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.runtime.sendMessage({ type: RUNTIME_MESSAGE.TAB_CLOSED, tabId }).catch(() => undefined);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    chrome.runtime
      .sendMessage({ type: RUNTIME_MESSAGE.TAB_UPDATED, tabId, url: changeInfo.url })
      .catch(() => undefined);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.runtime.sendMessage({ type: RUNTIME_MESSAGE.TAB_ACTIVATED, tabId }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isPollStatusRequest(message)) {
    void runStatusPoll().then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }
  if (!isCaptureTabRequest(message)) {
    return;
  }
  void handleCaptureTabRequest(message, (query) => chrome.tabs.query(query), {
    inject: async (tabId) => {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [captureScript],
      });
    },
    send: (tabId, payload) => chrome.tabs.sendMessage(tabId, payload),
  }).then((job) => {
    sendResponse({ job });
  });
  return true;
});
