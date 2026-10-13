import { describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";

import { MARK_HOVER_OFFSET, MARK_HOVER_STEPS } from "../../routines/hiringcafe/constants.js";

import {
  approachPoints,
  clamp,
  formatHoverDiagnostics,
  hitInsideCard,
  hoverTargetInDocument,
  overlayTargetInDocument,
  pageZoomOf,
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
      <div class="job-card">
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
    document.elementFromPoint = (x, y) => {
      const rect = mark.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return mark;
      return document.body;
    };
  } else {
    document.elementFromPoint = () => document.body;
  }
  return { document, card, mark };
}

describe("pageZoomOf", () => {
  test("reads pinch-zoom scale and ignores outer/inner browser zoom", () => {
    expect(pageZoomOf()).toBe(1);
    expect(pageZoomOf({ visualViewport: { scale: 0.9 } })).toBe(0.9);
    expect(
      pageZoomOf({ visualViewport: { scale: 1, width: 1280 }, innerWidth: 1534, outerWidth: 1280 }),
    ).toBe(1);
  });
});

describe("viewportHoverPoint", () => {
  test("uses the card offset when it stays on the card and in the viewport", () => {
    expect(
      viewportHoverPoint({ left: 10, top: 20, width: 300, height: 200 }, MARK_HOVER_OFFSET, {
        width: 800,
        height: 600,
      }),
    ).toEqual({ x: 110, y: 120, clamped: false });
  });

  test("uses the visible-card center when the side panel hides offset 100,100", () => {
    expect(
      viewportHoverPoint({ left: 0, top: 0, width: 400, height: 200 }, MARK_HOVER_OFFSET, {
        width: 90,
        height: 500,
      }),
    ).toEqual({ x: 45, y: 100, clamped: true });
    expect(clamp(12, 1, 8)).toBe(8);
  });
});

describe("approachPoints", () => {
  test("starts outside the card then steps into the destination", () => {
    const rect = { left: 20, top: 40, width: 320, height: 220, right: 340, bottom: 260 };
    const dest = { x: 120, y: 140 };
    const points = approachPoints(rect, dest, { width: 800, height: 600 }, MARK_HOVER_STEPS);
    expect(points[0]).toEqual({ x: 120, y: 32 });
    expect(points.at(-1)).toEqual(dest);
    expect(points).toHaveLength(MARK_HOVER_STEPS + 1);
    expect(points[1].y).toBeGreaterThan(points[0].y);
  });
});

describe("hitInsideCard", () => {
  test("requires elementFromPoint to land on the card or a descendant", () => {
    const { document, card } = cardDocument();
    const child = card.querySelector("a");
    expect(hitInsideCard(card, 120, 140, () => child)).toMatchObject({ ok: true, tag: "A" });
    expect(hitInsideCard(card, 120, 140, () => document.body)).toMatchObject({
      ok: false,
      tag: "BODY",
    });
  });
});

describe("formatHoverDiagnostics", () => {
  test("prints rect, viewport, scroll, dpr, hit, and overlay", () => {
    expect(
      formatHoverDiagnostics({
        rect: { left: 10, top: 20, width: 320, height: 220 },
        viewport: { width: 800, height: 600 },
        scroll: { x: 0, y: 400 },
        dpr: 2,
        zoom: 1,
        hit: { tag: "DIV", classes: "job-card hc-card" },
        overlay: false,
        candidates: [],
      }),
    ).toBe(
      "rect=10,20 320x220 viewport=800x600 scroll=0,400 dpr=2 zoom=1 hit=DIV.job-card.hc-card overlay=no candidates=none",
    );
  });
});

describe("hoverTargetInDocument", () => {
  test("scrolls the card into view and returns a CSS-pixel approach path", async () => {
    const { document, card } = cardDocument();
    const result = await hoverTargetInDocument(
      document,
      { selector: CARD, x: 100, y: 100 },
      { width: 800, height: 600 },
      () => card,
    );
    expect(card.scrolled).toBe(true);
    expect(result).toMatchObject({
      found: true,
      x: 120,
      y: 140,
      clamped: false,
    });
    expect(result.approach[0]).toEqual({ x: 120, y: 32 });
    expect(result.approach.at(-1)).toEqual({ x: 120, y: 140 });
    expect(result.diagnosticsText).toContain("viewport=800x600");
    expect(result.diagnostics.dpr).toBe(1);
    const missing = await hoverTargetInDocument(document, { selector: "[data-missing]" });
    expect(missing.found).toBe(false);
    expect(missing.diagnosticsText).toContain("hit=none");
  });

  test("re-checks elementFromPoint after clamping to the visible card", async () => {
    const { document, card } = cardDocument({ left: 0, top: 0, width: 400, height: 200 });
    const hits = [];
    const result = await hoverTargetInDocument(
      document,
      { selector: CARD, x: 100, y: 100 },
      { width: 90, height: 500 },
      (x, y) => {
        hits.push({ x, y });
        return x === 45 && y === 100 ? card : document.body;
      },
    );
    expect(result).toMatchObject({ found: true, x: 45, y: 100, clamped: true });
    expect(hits[0]).toEqual({ x: 45, y: 100 });
  });

  test("rejects a hover whose elementFromPoint is outside the card", async () => {
    const { document } = cardDocument();
    const result = await hoverTargetInDocument(
      document,
      { selector: CARD, x: 100, y: 100 },
      { width: 800, height: 600 },
      () => document.body,
    );
    expect(result.found).toBe(false);
    expect(result.diagnostics.hit.tag).toBe("BODY");
    expect(result.diagnosticsText).toContain("overlay=no");
  });
});

describe("overlayTargetInDocument", () => {
  test("returns the Mark Applied center when the overlay is in the DOM", () => {
    const { document } = cardDocument();
    expect(
      overlayTargetInDocument(
        document,
        { selector: CARD, clickSelector: MARK, contains: "Mark Applied", exact: true },
        { width: 800, height: 600 },
      ),
    ).toMatchObject({
      found: true,
      x: 296,
      y: 60,
      candidates: expect.arrayContaining(["Mark Applied"]),
    });
    expect(
      overlayTargetInDocument(document, {
        selector: CARD,
        clickSelector: MARK,
        contains: "Save for later",
        exact: true,
      }),
    ).toMatchObject({ found: false });
  });

  test("returns found false when elementFromPoint misses the Mark Applied control", () => {
    const { document } = cardDocument();
    expect(
      overlayTargetInDocument(
        document,
        { selector: CARD, clickSelector: MARK, contains: "Mark Applied", exact: true },
        { width: 800, height: 600 },
        () => document.body,
      ),
    ).toMatchObject({ found: false, hit: { tag: "BODY" } });
  });

  test("finds a live button.bg-white Mark Applied without a div.bg-white selector", () => {
    const { document } = parseHTML(`<!DOCTYPE html><html><body>
      <div data-testid="job-results"><div class="hc-card-grid">
        <div class="job-card">
          <a href="/job/help-desk-coordinator-reqaaa1111111111">Job Posting</a>
          <button class="p-2 bg-white hover:bg-gray-100 rounded flex-none text-black">Mark Applied</button>
        </div>
      </div></div>
    </body></html>`);
    const button = document.querySelector("button");
    button.getBoundingClientRect = () => ({
      left: 200,
      top: 40,
      width: 80,
      height: 20,
      right: 280,
      bottom: 60,
    });
    document.elementFromPoint = () => button;
    expect(
      overlayTargetInDocument(
        document,
        { selector: CARD, clickSelector: MARK, contains: "Mark Applied", exact: true },
        { width: 800, height: 600 },
      ),
    ).toMatchObject({
      found: true,
      x: 240,
      y: 50,
      candidates: expect.arrayContaining(["Mark Applied"]),
    });
  });

  test("returns Applied and App Tracker candidates when the toggle already flipped", () => {
    const { document } = parseHTML(`<!DOCTYPE html><html><body>
      <div data-testid="job-results"><div class="hc-card-grid">
        <div class="job-card">
          <a href="/job/help-desk-coordinator-reqaaa1111111111">Job Posting</a>
          <div class="absolute top-0 right-0">
            <button class="bg-white">Applied</button>
            <button class="bg-pink-600">App Tracker</button>
          </div>
        </div>
      </div></div>
    </body></html>`);
    expect(
      overlayTargetInDocument(document, {
        selector: CARD,
        clickSelector: MARK,
        contains: "Mark Applied",
        exact: true,
      }),
    ).toMatchObject({
      found: false,
      candidates: expect.arrayContaining(["Applied", "App Tracker"]),
    });
  });

  test("waitForOverlayTarget returns as soon as the overlay is present", async () => {
    const { document } = cardDocument({ overlay: true });
    await expect(
      waitForOverlayTarget(
        document,
        { selector: CARD, clickSelector: MARK, contains: "Mark Applied", exact: true, wait: 0 },
        () => 0,
      ),
    ).resolves.toMatchObject({ found: true });
    const missing = cardDocument({ overlay: false }).document;
    await expect(
      waitForOverlayTarget(missing, { selector: CARD, clickSelector: MARK, wait: 0 }, () => 0),
    ).resolves.toMatchObject({ found: false });
    let tick = 0;
    await expect(
      waitForOverlayTarget(missing, { selector: CARD, clickSelector: MARK, wait: 200 }, () =>
        tick++ === 0 ? 0 : 500,
      ),
    ).resolves.toMatchObject({ found: false });
  });
});
