import { describe, expect, test } from "bun:test";

import { BADGE_COLOR_DRAFTS, BADGE_TEXT_COLOR } from "./appearance";
import { applyToolbarBadge, chromeToolbarBadgePort } from "./apply";

describe("applyToolbarBadge", () => {
  test("writes badge text, background, and text color", async () => {
    const calls: string[] = [];
    await applyToolbarBadge(
      { text: "3", backgroundColor: BADGE_COLOR_DRAFTS, textColor: BADGE_TEXT_COLOR },
      {
        async setBadgeText(details) {
          calls.push(`text:${details.text}`);
        },
        async setBadgeBackgroundColor(details) {
          calls.push(`bg:${JSON.stringify(details.color)}`);
        },
        async setBadgeTextColor(details) {
          calls.push(`fg:${JSON.stringify(details.color)}`);
        },
      },
    );
    expect(calls).toEqual([
      "text:3",
      `bg:${JSON.stringify(BADGE_COLOR_DRAFTS)}`,
      `fg:${JSON.stringify(BADGE_TEXT_COLOR)}`,
    ]);
  });

  test("skips text color when the port has no setter", async () => {
    const calls: string[] = [];
    await applyToolbarBadge(
      { text: "!", backgroundColor: BADGE_COLOR_DRAFTS, textColor: BADGE_TEXT_COLOR },
      {
        async setBadgeText(details) {
          calls.push(details.text ?? "");
        },
        async setBadgeBackgroundColor() {
          calls.push("bg");
        },
      },
    );
    expect(calls).toEqual(["!", "bg"]);
  });

  test("chromeToolbarBadgePort returns chrome.action", () => {
    const action = {
      async setBadgeText() {
        return;
      },
      async setBadgeBackgroundColor() {
        return;
      },
    };
    (globalThis as unknown as { chrome: { action: typeof action } }).chrome = { action };
    expect(chromeToolbarBadgePort()).toBe(action);
  });
});
