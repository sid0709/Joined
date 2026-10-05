import { isAcornSessionCookie, syncAcornSession } from "./auth/acorn-auth";
import { isAcornSocketConnected, scheduleConnectAcornSocket } from "./acorn-socket";
import { rekeyPipelineUsage } from "./pipeline/usage-tracker";
import { bindContentScriptInjection, injectIntoOpenTabs } from "./inject-content";
import { rekeyTabJob, unbindTabJob } from "./tab-job-session";
import { rekeyCustomTab, refreshCustomTabMeta, unbindCustomTab } from "./tab-custom-session";
import { clearTabPipeline, rekeyTabPipeline } from "./tab-pipeline-session";
import { MSG, ACORN_SIDEBAR_PORT } from "./types";
import { routeMessage } from "./background/message-router";
import { connectSocket, sidebarPorts, socketHandlers } from "./background/socket-connection";
import {
  KEEP_ALIVE_ALARM,
  WORK_KEEP_ALIVE_ALARM,
  anyTabWorking,
  customGenerateTabIds,
  pipelineRunningTabIds,
} from "./background/work-state";

function enableSidePanelOnActionClick(): void {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
}

chrome.alarms.create(KEEP_ALIVE_ALARM, { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEP_ALIVE_ALARM) {
    if (sidebarPorts.size > 0) void chrome.runtime.getPlatformInfo();
    if (!isAcornSocketConnected()) void connectSocket().catch(() => undefined);
  }
  if (alarm.name === WORK_KEEP_ALIVE_ALARM) {
    if (anyTabWorking()) void chrome.runtime.getPlatformInfo();
    else void chrome.alarms.clear(WORK_KEEP_ALIVE_ALARM);
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== ACORN_SIDEBAR_PORT) return;
  sidebarPorts.add(port);
  try {
    port.postMessage({
      type: MSG.SOCKET_STATUS,
      connected: isAcornSocketConnected(),
    });
  } catch {
    sidebarPorts.delete(port);
    return;
  }
  void connectSocket().catch(() => undefined);
  port.onDisconnect.addListener(() => {
    sidebarPorts.delete(port);
  });
});

void connectSocket().catch(() => undefined);
enableSidePanelOnActionClick();
bindContentScriptInjection();
void injectIntoOpenTabs();
chrome.runtime.onInstalled.addListener(enableSidePanelOnActionClick);

chrome.tabs.onRemoved.addListener((tabId) => {
  void unbindTabJob(tabId);
  void unbindCustomTab(tabId);
  void clearTabPipeline(tabId);
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  if (pipelineRunningTabIds.delete(removedTabId)) {
    pipelineRunningTabIds.add(addedTabId);
  }
  if (customGenerateTabIds.delete(removedTabId)) {
    customGenerateTabIds.add(addedTabId);
  }
  rekeyPipelineUsage(removedTabId, addedTabId);
  void rekeyTabJob(removedTabId, addedTabId);
  void rekeyCustomTab(removedTabId, addedTabId);
  void rekeyTabPipeline(removedTabId, addedTabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    !changeInfo.url &&
    !changeInfo.title &&
    !changeInfo.favIconUrl &&
    changeInfo.status !== "complete"
  ) {
    return;
  }
  void refreshCustomTabMeta(tabId, {
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
  });
});

// acorn-frontend is where a person signs in or out: follow its cookie.
chrome.cookies.onChanged.addListener(({ cookie }) => {
  if (isAcornSessionCookie(cookie)) void syncAcornSession();
});
void syncAcornSession();

chrome.storage.onChanged.addListener((changes) => {
  if (changes.acornApiUrl || changes.acornSession) {
    scheduleConnectAcornSocket(socketHandlers);
  }
});

chrome.runtime.onMessage.addListener(routeMessage);
