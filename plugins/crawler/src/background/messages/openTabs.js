/* global chrome */

// UI -> background command: open multiple tabs (payload: { urls: [] })
export function handleOpenTabs(message) {
  const urls = message.payload && Array.isArray(message.payload.urls) ? message.payload.urls : [];
  if (!urls.length) return;
  for (const url of urls) {
    try {
      chrome.tabs.create({ url, active: false });
    } catch (e) {
      console.error("Failed to open tab for", url, e);
    }
  }
}
