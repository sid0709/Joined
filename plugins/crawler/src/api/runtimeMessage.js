/* global chrome */
import { ROUTINE_EXEC_ACTION } from "../routineKit/protocol";

/** True inside the extension; false in the plain `bun run dev:crawler` page. */
export const hasExtensionRuntime = () =>
  typeof chrome !== "undefined" && typeof chrome.runtime?.sendMessage === "function";

/** Send to the background and resolve with its response; reject on `{ success: false }`. */
export function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    if (!hasExtensionRuntime()) {
      reject(new Error("The extension runtime is not available on this page"));
      return;
    }
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (response?.success === false)
        reject(new Error(response.error || "Background request failed"));
      else resolve(response);
    });
  });
}

/** Run one routine op in a tab (see contentScript/messages/routineOps.js). */
export const execRoutineOp = (tabId, payload) =>
  sendRuntimeMessage({ action: ROUTINE_EXEC_ACTION, tabId, payload }).then(
    (response) => response?.result ?? {},
  );

/** Open a URL in a new tab beside the current one. */
export function openInNewTab(url) {
  if (typeof chrome !== "undefined" && chrome.tabs?.create) {
    void chrome.tabs.create({ url });
  } else {
    window.open(url, "_blank", "noopener");
  }
}
