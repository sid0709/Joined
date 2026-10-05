// Messaging helpers for the Extension UI to communicate with the content script.
// Kept simple so UI components can import and send standardized messages.

export const commonTags = [
  "div",
  "a",
  "span",
  "img",
  "input",
  "button",
  "li",
  "h1",
  "h2",
  "p",
  "form",
  "section",
  "header",
  "footer",
  "textarea",
  "label",
];
export const commonProperties = [
  "id",
  "class",
  "name",
  "href",
  "src",
  "alt",
  "for",
  "type",
  "role",
  "aria-label",
  "data-testid",
];

/* global chrome */

let rememberedPageTab = null;

export function isEligiblePageTab(tab) {
  return Number.isInteger(tab?.id) && /^https?:/i.test(tab.url || "");
}

export function rememberPageTab(tab) {
  if (!isEligiblePageTab(tab)) {
    rememberedPageTab = null;
    return null;
  }
  rememberedPageTab = {
    id: tab.id,
    url: tab.url,
    title: typeof tab.title === "string" ? tab.title : "",
  };
  return { ...rememberedPageTab };
}

export function getRememberedPageTab() {
  return rememberedPageTab ? { ...rememberedPageTab } : null;
}

export function clearRememberedPageTab() {
  rememberedPageTab = null;
}

export async function rememberActivePageTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return rememberPageTab(tab);
  } catch {
    clearRememberedPageTab();
    return null;
  }
}

async function resolveActivePageTabId() {
  if (rememberedPageTab) return rememberedPageTab.id;
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (isEligiblePageTab(tab)) return tab.id;
  } catch {
    // Background will fall back to its own tab resolution.
  }
  return undefined;
}

export const highlightByPattern = async (tag, property, pattern) => {
  if (!pattern) return;
  const tabId = await resolveActivePageTabId();
  chrome.runtime.sendMessage({
    action: "highlightByPattern",
    tabId,
    payload: {
      componentType: tag,
      propertyName: property,
      pattern: pattern,
      tabId,
    },
  });
};

export const handleHighlight = highlightByPattern;

export const clearHighlights = async () => {
  const tabId = await resolveActivePageTabId();
  chrome.runtime.sendMessage({ action: "clearHighlight", tabId, payload: { tabId } });
};

export const handleClear = clearHighlights;

// Send an executeAction command to the content script. If `identifier` is provided
// and action === 'fetch', content script will echo back a `fetchResult` with same identifier.
export const executeAction = async (
  tag,
  property,
  pattern,
  order,
  action,
  actionValue,
  fetchType,
  identifier,
) => {
  const tabId = await resolveActivePageTabId();
  const payload = {
    componentType: tag,
    propertyName: property,
    pattern: pattern,
    order: parseInt(order, 10) || 0,
    action: action,
    tabId,
  };

  if (actionValue !== undefined && actionValue !== null) payload.value = actionValue;
  if (fetchType) payload.fetchType = fetchType;
  if (identifier) payload.identifier = identifier;

  chrome.runtime.sendMessage({
    action: "executeAction",
    tabId,
    payload,
  });
};

export const handleAction = executeAction;

export const executeActionsSequence = (actions, runId) => {
  const payload = {
    runId: runId || null,
    actions: Array.isArray(actions) ? actions : [],
  };

  chrome.runtime.sendMessage({
    action: "executeActionsSequence",
    payload,
  });
};

export const executeActionsParallel = (actions, runId) => {
  const payload = {
    runId: runId || null,
    actions: Array.isArray(actions) ? actions : [],
  };

  chrome.runtime.sendMessage({
    action: "executeActionsParallel",
    payload,
  });
};

export const highlightInteractables = (runId) => {
  chrome.runtime.sendMessage({
    action: "highlightInteractables",
    payload: { runId },
  });
};
