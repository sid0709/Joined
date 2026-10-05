console.log("Scout background service worker initialized");

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.runtime.sendMessage({ type: "tab-closed", tabId }).catch(() => undefined);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    chrome.runtime
      .sendMessage({ type: "tab-updated", tabId, url: changeInfo.url })
      .catch(() => undefined);
  }
});
