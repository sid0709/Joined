import { describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";

import { MARK_HOVER_OFFSET } from "../../routines/hiringcafe/constants.js";

import {
  clamp,
  hoverTargetInDocument,
  overlayTargetInDocument,
  viewportHoverPoint,
  waitForOverlayTarget,
} from "./hoverTarget.js";

const CARD = '[data-testid="job-results"] .hc-card-grid > div';
const MARK = "div.absolute.top-0.right-0 div.bg-white";

function cardDocument({ overlay = true, width = 320, height = 220, left = 20, top = 40 } = {}) {
  const overlayHtml = overlay
    ? `<div class="absolute top-0 right-0"><div class="bg-white">Mark Applied</div></div>`
    : "";
  const { document } = parseHTML(`<!DOCTYPE html><html><body>
    <div data-testid="job-results"><div class="hc-card-grid">
      <div>
        <a href="/job/help-desk-coordinator-reqaaa1111111111">Job Posting</a>
        ${overlayHtml}
      </div>
    </div></div>
  </body></html>`);
  const card = document.querySelector(CARD);
  card.getBoundingClientRect = () => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  });
  card.scrollIntoView = () => {
    card.scrolled = true;
  };
  const mark = document.querySelector(MARK);
  if (mark) {
    mark.getBoundingClientRect = () => ({
      left: left + width - 80,
      top: top + 8,
      width: 72,
      height: 24,
      right: left + width - 8,
      bottom: top + 32,
    });
  }
  return document;
}

describe("viewportHoverPoint", () => {
  test("uses the card offset when it stays on the card and in the viewport", () => {
    expect(
      viewportHoverPoint({ left: 10, top: 20, width: 300, height: 200 }, MARK_HOVER_OFFSET, {
        width: 800,
        height: 600,
      }),
    ).toEqual({ x: 110, y: 120 });
  });

  test("falls back to the clamped center when the side panel hides offset 100,100", () => {
    expect(
      viewportHoverPoint({ left: 0, top: 0, width: 400, height: 200 }, MARK_HOVER_OFFSET, {
        width: 90,
        height: 500,
      }),
    ).toEqual({ x: 89, y: 100 });
    expect(clamp(12, 1, 8)).toBe(8);
  });
});

describe("hoverTargetInDocument", () => {
  test("scrolls the card into view and returns the trusted hover point", () => {
    const document = cardDocument();
    const result = hoverTargetInDocument(
      document,
      { selector: CARD, x: 100, y: 100 },
      { width: 800, height: 600 },
    );
    expect(document.querySelector(CARD).scrolled).toBe(true);
    expect(result).toEqual({ found: true, x: 120, y: 140 });
    expect(hoverTargetInDocument(document, { selector: "[data-missing]" })).toEqual({
      found: false,
    });
  });
});

describe("overlayTargetInDocument", () => {
  test("returns the Mark Applied center when the overlay is in the DOM", () => {
    const document = cardDocument();
    expect(
      overlayTargetInDocument(
        document,
        { selector: CARD, clickSelector: MARK, contains: "Mark Applied", exact: true },
        { width: 800, height: 600 },
      ),
    ).toEqual({ found: true, x: 296, y: 60 });
    expect(
      overlayTargetInDocument(document, {
        selector: CARD,
        clickSelector: MARK,
        contains: "Save for later",
        exact: true,
      }),
    ).toEqual({ found: false });
  });

  test("waitForOverlayTarget returns as soon as the overlay is present", async () => {
    const document = cardDocument({ overlay: true });
    await expect(
      waitForOverlayTarget(
        document,
        { selector: CARD, clickSelector: MARK, contains: "Mark Applied", exact: true, wait: 0 },
        () => 0,
      ),
    ).resolves.toMatchObject({ found: true });
    const missing = cardDocument({ overlay: false });
    await expect(
      waitForOverlayTarget(missing, { selector: CARD, clickSelector: MARK, wait: 0 }, () => 0),
    ).resolves.toEqual({ found: false });
    let tick = 0;
    await expect(
      waitForOverlayTarget(missing, { selector: CARD, clickSelector: MARK, wait: 200 }, () =>
        tick++ === 0 ? 0 : 500,
      ),
    ).resolves.toEqual({ found: false });
  });
});
