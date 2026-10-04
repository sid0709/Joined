/* global chrome */

export function safeSendMessage(message) {
  try {
    const result = chrome.runtime?.sendMessage?.(message);
    if (result && typeof result.catch === "function") {
      result.catch(() => {});
    }
  } catch (e) {
    // Ignore missing receivers; log unexpected errors
    if (!/Receiving end does not exist/.test(String(e))) {
      console.error("Failed to send runtime message", e);
    }
  }
}

export function storageGet(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(result?.[key] ?? null);
    });
  });
}

export function storageSet(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(value, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

export function readStorageValue(key) {
  return new Promise((resolve) => {
    try {
      chrome.storage?.local?.get?.(key, (result) => {
        if (chrome.runtime?.lastError) {
          resolve(null);
          return;
        }
        resolve(result?.[key] ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

export function normalizeBaseUrl(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "";
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
