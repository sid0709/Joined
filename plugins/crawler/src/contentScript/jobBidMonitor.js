import {
  collectTextCandidates,
  matchesSubmitKeyword,
  containsConfirmationKeyword,
} from "./submitDetector";
import {
  CONTENT_SCRIPT_INJECTED_ATTRIBUTE,
  sendRuntimeMessageSafely,
} from "./contentScriptLifecycle";

/* global chrome */

const BUTTON_SELECTOR =
  'button, a, input[type="submit"], input[type="button"], input[type="image"], [role="button"]';
const KEY_TRIGGER_SET = new Set(["Enter", " "]);
const hookedElements = new WeakSet();
const hookedElementCleanups = new Set();
const activeDetections = new WeakMap();
const runningDetections = new Set();
const MIN_DOM_DELTA = 0.2; // 20%
const MONITOR_WINDOW_MS = 15000;
let buttonReportScheduled = false;
let buttonReportFrame = null;
let buttonObserver = null;
let bootListener = null;
let monitorStopped = false;

function stopJobBidMonitor() {
  if (monitorStopped) return;
  monitorStopped = true;
  buttonReportScheduled = false;

  if (buttonReportFrame !== null) {
    window.cancelAnimationFrame(buttonReportFrame);
    buttonReportFrame = null;
  }
  buttonObserver?.disconnect();
  buttonObserver = null;
  if (bootListener) {
    document.removeEventListener("DOMContentLoaded", bootListener);
    bootListener = null;
  }
  document.removeEventListener("submit", handleFormSubmit, true);
  for (const cleanup of hookedElementCleanups) cleanup();
  hookedElementCleanups.clear();
  for (const detection of [...runningDetections]) detection.stop();

  try {
    document.documentElement?.removeAttribute(CONTENT_SCRIPT_INJECTED_ATTRIBUTE);
    window.contentScriptInjected = false;
    window.__jobBidMonitorInitialized = false;
  } catch {
    // DOM cleanup is best-effort after the extension context is gone.
  }
}

function sendMonitorMessage(message, failureLabel) {
  let runtime = null;
  try {
    runtime = typeof chrome === "undefined" ? null : chrome.runtime;
  } catch {
    stopJobBidMonitor();
    return false;
  }
  return sendRuntimeMessageSafely(runtime, message, {
    onInvalidated: stopJobBidMonitor,
    onError: (error) => console.error(failureLabel, error),
  });
}

function getPrimaryLabel(element) {
  const candidates = collectTextCandidates(element);
  if (candidates.length) return candidates[0];
  return element?.tagName?.toLowerCase() || "unknown";
}

function buildElementSignature(element) {
  if (!element || !element.tagName) return "unknown";
  const tag = element.tagName.toLowerCase();
  const idPart = element.id ? `#${element.id}` : "";
  const classPart =
    typeof element.className === "string" && element.className.trim()
      ? `.${element.className.trim().replace(/\s+/g, ".")}`
      : "";
  return `${tag}${idPart}${classPart}`;
}

function getBodyTextLength() {
  const text = document?.body?.innerText || "";
  return text.length;
}

function scanElementAndChildren(root) {
  if (monitorStopped) return;
  if (!(root instanceof Element)) return;
  if (root.matches?.(BUTTON_SELECTOR)) {
    hookElement(root);
  }
  const candidates = root.querySelectorAll?.(BUTTON_SELECTOR);
  if (candidates?.length) {
    candidates.forEach((el) => hookElement(el));
  }
}

function hookElement(element) {
  if (monitorStopped || !element || hookedElements.has(element)) return;
  if (!matchesSubmitKeyword(element)) return;

  const handleClick = () => startDetection(element);
  const handleKeyDown = (event) => {
    if (KEY_TRIGGER_SET.has(event.key)) {
      startDetection(element);
    }
  };

  hookedElements.add(element);
  element.dataset.jobBidHooked = "true";
  element.addEventListener("click", handleClick, true);
  element.addEventListener("keydown", handleKeyDown, true);
  hookedElementCleanups.add(() => {
    element.removeEventListener("click", handleClick, true);
    element.removeEventListener("keydown", handleKeyDown, true);
    delete element.dataset.jobBidHooked;
  });
  scheduleButtonReport();
}

function reportJobBid(payload) {
  sendMonitorMessage({ action: "jobBidApplied", payload }, "Failed to send jobBidApplied message");
}

function sendJobBidStatus(status) {
  sendMonitorMessage(
    {
      action: "jobBidStatus",
      payload: {
        ...status,
        jobUrl: status?.jobUrl || window.location.href,
        timestamp: status?.timestamp || Date.now(),
      },
    },
    "Failed to send jobBidStatus",
  );
}

function summarizeButton(element) {
  return {
    text: getPrimaryLabel(element),
    signature: buildElementSignature(element),
    tag: element?.tagName?.toLowerCase() || "",
  };
}

function collectTargetButtons(root = document) {
  const scope = root instanceof Element ? root : document;
  return Array.from(scope.querySelectorAll(BUTTON_SELECTOR)).filter(matchesSubmitKeyword);
}

function reportCurrentButtons() {
  if (monitorStopped) return;
  const matches = collectTargetButtons(document);
  if (matches.length === 0) {
    sendJobBidStatus({
      state: "no-buttons",
      buttonCount: 0,
    });
    return;
  }
  sendJobBidStatus({
    state: "buttons-found",
    buttonCount: matches.length,
    buttons: matches.slice(0, 6).map(summarizeButton),
  });
}

function scheduleButtonReport() {
  if (monitorStopped || buttonReportScheduled) return;
  buttonReportScheduled = true;
  buttonReportFrame = requestAnimationFrame(() => {
    buttonReportFrame = null;
    buttonReportScheduled = false;
    if (monitorStopped) return;
    reportCurrentButtons();
  });
}

function createDetection(element) {
  const baselineUrl = window.location.href;
  const baselineLength = getBodyTextLength();
  let domChangePercent = 0;
  let matchedKeyword = null;
  let observer = null;
  let keywordInterval = null;
  let urlInterval = null;
  let timeoutId = null;
  let handleUnload = null;
  let finished = false;
  let controller = null;

  const cleanup = () => {
    if (observer) observer.disconnect();
    if (keywordInterval) window.clearInterval(keywordInterval);
    if (urlInterval) window.clearInterval(urlInterval);
    if (timeoutId) window.clearTimeout(timeoutId);
    if (handleUnload) {
      window.removeEventListener("pagehide", handleUnload, true);
      window.removeEventListener("beforeunload", handleUnload, true);
      handleUnload = null;
    }
    observer = null;
    keywordInterval = null;
    urlInterval = null;
    timeoutId = null;
  };

  const finalize = (reason) => {
    if (finished) return;
    finished = true;
    cleanup();
    activeDetections.delete(element);
    runningDetections.delete(controller);
    const currentUrl = window.location.href;

    if (reason === "timeout" || reason === "cancelled") {
      sendJobBidStatus({
        state: "not-counted",
        reason,
        button: summarizeButton(element),
        jobUrl: currentUrl,
      });
      return;
    }

    const payload = {
      reason,
      buttonText: getPrimaryLabel(element),
      buttonSignature: buildElementSignature(element),
      jobUrl: currentUrl,
      urlBefore: baselineUrl,
      urlAfter: currentUrl,
      domChangePercent: Number(domChangePercent.toFixed(3)),
      matchedKeyword,
      timestamp: Date.now(),
    };

    sendJobBidStatus({
      state: "applied",
      reason,
      button: summarizeButton(element),
      jobUrl: currentUrl,
    });
    reportJobBid(payload);
  };

  const monitorDom = () => {
    const currentLength = getBodyTextLength();
    const delta = Math.abs(currentLength - baselineLength);
    const base = Math.max(1, baselineLength);
    domChangePercent = delta / base;
    if (domChangePercent >= MIN_DOM_DELTA) {
      finalize("dom-change");
    }
  };

  const monitorKeywords = () => {
    const bodyMatch = containsConfirmationKeyword(document?.body?.innerText || "");
    const titleMatch = containsConfirmationKeyword(document?.title || "");
    const match = bodyMatch || titleMatch;
    if (match) {
      matchedKeyword = match;
      finalize("keyword");
    }
  };

  const monitorUrl = () => {
    if (window.location.href !== baselineUrl) {
      finalize("url-change");
    }
  };

  controller = {
    start() {
      if (monitorStopped || !document?.body) return;
      try {
        observer = new MutationObserver(monitorDom);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      } catch (e) {
        console.error("jobBidMonitor: failed to observe DOM", e);
      }
      keywordInterval = window.setInterval(monitorKeywords, 500);
      urlInterval = window.setInterval(monitorUrl, 200);
      timeoutId = window.setTimeout(() => finalize("timeout"), MONITOR_WINDOW_MS);
      handleUnload = () => finalize("url-change");
      window.addEventListener("pagehide", handleUnload, true);
      window.addEventListener("beforeunload", handleUnload, true);
    },
    cancel() {
      finalize("cancelled");
    },
    stop() {
      if (finished) return;
      finished = true;
      cleanup();
      activeDetections.delete(element);
      runningDetections.delete(controller);
    },
  };
  return controller;
}

function startDetection(element) {
  if (monitorStopped || !element || !document?.body) return;
  const existing = activeDetections.get(element);
  if (existing) return;
  sendJobBidStatus({
    state: "triggered",
    button: summarizeButton(element),
    jobUrl: window.location.href,
  });
  const detection = createDetection(element);
  activeDetections.set(element, detection);
  runningDetections.add(detection);
  detection.start();
}

function observeNewButtons() {
  if (monitorStopped || !document?.body) return;
  const observer = new MutationObserver((mutations) => {
    if (monitorStopped) return;
    for (const mutation of mutations) {
      if (!mutation.addedNodes?.length) continue;
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          scanElementAndChildren(node);
        }
      });
    }
    scheduleButtonReport();
  });
  try {
    observer.observe(document.body, { childList: true, subtree: true });
    buttonObserver = observer;
  } catch (e) {
    console.error("jobBidMonitor: failed to observe for new buttons", e);
  }
}

function handleFormSubmit(event) {
  if (monitorStopped) return;
  const submitter = event.submitter;
  if (submitter && matchesSubmitKeyword(submitter)) {
    startDetection(submitter);
    return;
  }
  const fallbackButton = event.target?.querySelector?.(BUTTON_SELECTOR);
  if (fallbackButton && matchesSubmitKeyword(fallbackButton)) {
    startDetection(fallbackButton);
  }
}

export function initJobBidMonitor() {
  if (window.__jobBidMonitorInitialized) return;
  monitorStopped = false;
  window.__jobBidMonitorInitialized = true;

  const boot = () => {
    bootListener = null;
    if (monitorStopped) return;
    try {
      scanElementAndChildren(document.body || document.documentElement);
      observeNewButtons();
      scheduleButtonReport();
      document.addEventListener("submit", handleFormSubmit, true);
    } catch (e) {
      console.error("Failed to initialize job bid monitor", e);
    }
  };

  if (document.readyState === "loading") {
    bootListener = boot;
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
