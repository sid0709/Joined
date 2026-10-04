import { messageHandler } from "./messageHandler";
import { initJobBidMonitor } from "./jobBidMonitor";
import { CONTENT_SCRIPT_INJECTED_ATTRIBUTE } from "./contentScriptLifecycle";

/* global chrome */

// Guard against duplicate injections (e.g., manifest `content_scripts` + `chrome.scripting.executeScript` fallback).
// Using a DOM attribute makes this robust even if Chrome runs the script in a fresh isolated world context.
const guardRoot = document?.documentElement;

if (!guardRoot?.hasAttribute(CONTENT_SCRIPT_INJECTED_ATTRIBUTE)) {
  try {
    guardRoot?.setAttribute(CONTENT_SCRIPT_INJECTED_ATTRIBUTE, "true");
  } catch {
    // Best-effort only; still proceed with the previous window-based guard.
  }

  if (typeof window.contentScriptInjected === "undefined") {
    window.contentScriptInjected = true;
  }

  // Ensure we receive sender and sendResponse and return the boolean
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      return messageHandler(message, sender, sendResponse) === true;
    } catch (e) {
      console.error("contentScript onMessage error:", e);
      return false;
    }
  });

  try {
    initJobBidMonitor();
  } catch (e) {
    console.error("Failed to boot job bid monitor", e);
  }

  try {
    // Intentionally no input effects/cursor injection.
  } catch (e) {
    console.error("Input effects disabled", e);
  }
}
