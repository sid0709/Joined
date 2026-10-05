import captureScript from "../content/capture?script&iife";
import { isCaptureTabRequest, RUNTIME_MESSAGE } from "../messaging/runtime";
import { handleCaptureTabRequest } from "./capture-tab";

console.log("Scout background service worker initialized");

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);

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
