import type { ToolbarBadgeAppearance } from "./appearance";

export interface ToolbarBadgePort {
  setBadgeText(details: chrome.action.BadgeTextDetails): Promise<void>;
  setBadgeBackgroundColor(details: chrome.action.BadgeColorDetails): Promise<void>;
  setBadgeTextColor?(details: chrome.action.BadgeColorDetails): Promise<void>;
}

export function chromeToolbarBadgePort(): ToolbarBadgePort {
  return chrome.action;
}

export async function applyToolbarBadge(
  appearance: ToolbarBadgeAppearance,
  port: ToolbarBadgePort,
): Promise<void> {
  await port.setBadgeText({ text: appearance.text });
  await port.setBadgeBackgroundColor({ color: appearance.backgroundColor });
  if (port.setBadgeTextColor) {
    await port.setBadgeTextColor({ color: appearance.textColor });
  }
}
