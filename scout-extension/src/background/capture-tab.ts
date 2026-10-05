import { parseCapturedJobResponse } from "../capture/capture";
import type { CapturedJob } from "../capture/types";
import {
  CAPTURE_TIMEOUT_MS,
  isCaptureTabRequest,
  RUNTIME_MESSAGE,
  withTimeout,
} from "../messaging/runtime";
import { canInjectIntoUrl } from "./inject";

export interface TabCapturePort {
  inject(tabId: number): Promise<void>;
  send(tabId: number, message: unknown): Promise<unknown>;
}

export type QueriedTab = Pick<chrome.tabs.Tab, "id" | "url">;

export async function queryActiveTab(
  queryTabs: (query: chrome.tabs.QueryInfo) => Promise<QueriedTab[]>,
): Promise<{ id: number; url?: string } | null> {
  const tabs = await queryTabs({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (!tab || tab.id == null) {
    return null;
  }
  return { id: tab.id, url: tab.url };
}

export async function captureTabJob(
  tab: { id: number; url?: string },
  port: TabCapturePort,
  timeoutMs = CAPTURE_TIMEOUT_MS,
): Promise<CapturedJob | null> {
  if (!canInjectIntoUrl(tab.url)) {
    return null;
  }
  try {
    await port.inject(tab.id);
    const response = await withTimeout(
      port.send(tab.id, { type: RUNTIME_MESSAGE.CAPTURE_JOB }),
      timeoutMs,
    );
    return parseCapturedJobResponse(response);
  } catch {
    return null;
  }
}

export async function handleCaptureTabRequest(
  message: unknown,
  queryTabs: (query: chrome.tabs.QueryInfo) => Promise<QueriedTab[]>,
  port: TabCapturePort,
): Promise<CapturedJob | null> {
  if (!isCaptureTabRequest(message)) {
    return null;
  }
  const tab = await queryActiveTab(queryTabs);
  if (!tab) {
    return null;
  }
  return captureTabJob(tab, port);
}
