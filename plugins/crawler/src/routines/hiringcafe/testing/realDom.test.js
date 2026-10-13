import { describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";

import {
  hoverTargetInDocument,
  overlayTargetInDocument,
} from "../../../contentScript/actions/hoverTarget.js";
import {
  appliedStateFromHtml,
  findMarkAppliedInOverlay,
  hasAppliedCheck,
  isListCardApplied,
  overlayAppliedCandidateTexts,
  overlayFromHit,
  overlayRoot,
} from "../appliedState.js";
import {
  APP_TRACKER_TEXT,
  APPLIED_TOGGLE_TEXT,
  JOB_CARD,
  MARK_APPLIED,
  MARK_APPLIED_TEXT,
} from "../constants.js";
import { documentFromHtml } from "../html.js";
import { pickNextJob } from "../runPass.js";

import {
  APPLIED_JOB,
  LIVE_CARD_RECT,
  LIVE_MARK_CENTER,
  LIVE_MARK_RECT,
  LIVE_VIEWPORT,
  REAL_DOM_FILES,
  UNAPPLIED_JOB,
  listWithRealCard,
  readRealDom,
} from "./realDom.js";

function documentWithRealCard(name) {
  const html = listWithRealCard(readRealDom(name));
  const { document } = parseHTML(html);
  const card = document.querySelector(JOB_CARD);
  const button = [...document.querySelectorAll("button")].find(
    (node) => node.textContent.trim() === MARK_APPLIED_TEXT,
  );
  if (card) {
    card.getBoundingClientRect = () => LIVE_CARD_RECT;
    card.scrollIntoView = () => {};
  }
  if (button) {
    button.getBoundingClientRect = () => LIVE_MARK_RECT;
    document.elementFromPoint = (x, y) => {
      if (x === LIVE_MARK_CENTER.x && y === LIVE_MARK_CENTER.y) return button;
      return card;
    };
  }
  return { document, card, button, html };
}

describe("real HiringCafe DOM fixtures", () => {
  test("card-unapplied-hover.html finds Mark Applied in the overlay layer and clicks its center", () => {
    const { document, card, button, html } = documentWithRealCard("card-unapplied-hover.html");
    expect(REAL_DOM_FILES).toContain("card-unapplied-hover.html");
    expect(overlayRoot(card)?.className).toContain("cursor-zoom-in");
    expect(findMarkAppliedInOverlay(card)).toBe(button);
    expect(overlayAppliedCandidateTexts(card)).toEqual(
      expect.arrayContaining([MARK_APPLIED_TEXT, "Save"]),
    );
    expect(appliedStateFromHtml(html, UNAPPLIED_JOB)).toMatchObject({
      marked: false,
      canMark: true,
    });
    const hit = document.querySelector("div.flex.justify-between.items-end");
    expect(hit?.className).toContain("justify-between");
    expect(hit?.contains(button)).toBe(false);
    expect(overlayRoot(hit)?.className).toContain("cursor-zoom-in");
    expect(overlayFromHit(hit, card)?.className).toContain("cursor-zoom-in");
    expect(findMarkAppliedInOverlay(hit)).toBe(button);
    expect(
      overlayTargetInDocument(
        document,
        {
          selector: JOB_CARD,
          clickSelector: MARK_APPLIED,
          contains: MARK_APPLIED_TEXT,
          exact: true,
        },
        LIVE_VIEWPORT,
      ),
    ).toMatchObject({
      found: true,
      x: LIVE_MARK_CENTER.x,
      y: LIVE_MARK_CENTER.y,
      candidates: expect.arrayContaining([MARK_APPLIED_TEXT]),
    });
    expect(document.elementFromPoint(LIVE_MARK_CENTER.x, LIVE_MARK_CENTER.y)).toBe(button);
  });

  test("card-unapplied-hover.html hover hit on the overlay row is overlay=yes with Mark Applied", async () => {
    const { document, card, button } = documentWithRealCard("card-unapplied-hover.html");
    const row = document.querySelector("div.flex.justify-between.items-end");
    const hovered = await hoverTargetInDocument(
      document,
      { selector: JOB_CARD, x: 100, y: 100 },
      LIVE_VIEWPORT,
      () => row,
    );
    expect(hovered).toMatchObject({
      found: true,
      diagnostics: {
        overlay: true,
        hit: { tag: "DIV", classes: expect.stringContaining("justify-between") },
        candidates: expect.arrayContaining([MARK_APPLIED_TEXT]),
      },
    });
    expect(hovered.diagnosticsText).toContain("overlay=yes");
    expect(hovered.diagnosticsText).toContain("319.75x416.5");
    expect(findMarkAppliedInOverlay(row)).toBe(button);
    expect(card.contains(row)).toBe(true);
  });

  test("card-applied-hover.html skips when the overlay shows Applied plus a check and App Tracker", async () => {
    const { card, html } = documentWithRealCard("card-applied-hover.html");
    expect(findMarkAppliedInOverlay(card)).toBeNull();
    expect(hasAppliedCheck(card)).toBe(true);
    expect(isListCardApplied(card)).toBe(true);
    expect(overlayAppliedCandidateTexts(card)).toEqual(
      expect.arrayContaining([APPLIED_TOGGLE_TEXT, APP_TRACKER_TEXT]),
    );
    expect(overlayAppliedCandidateTexts(card)).not.toContain(MARK_APPLIED_TEXT);
    expect(appliedStateFromHtml(html, APPLIED_JOB)).toMatchObject({
      marked: true,
      canMark: false,
    });
    expect(
      overlayTargetInDocument(documentFromHtml(html), {
        selector: JOB_CARD,
        clickSelector: MARK_APPLIED,
        contains: MARK_APPLIED_TEXT,
        exact: true,
      }),
    ).toMatchObject({ found: false, candidates: expect.arrayContaining([APP_TRACKER_TEXT]) });
    const marked = [];
    const next = await pickNextJob({
      jobs: [{ id: APPLIED_JOB.id, listApplied: isListCardApplied(card) }],
      lastJobId: "",
      handledIds: new Set(),
      noteJobDecision: () => {},
      markJob: async (id) => marked.push(id),
      readApplied: async (job) => appliedStateFromHtml(html, job),
      markAppliedEnabled: true,
    });
    expect(next).toBeNull();
    expect(marked).toEqual([]);
  });

  test("elementsFromPoint.txt has no links and starts at the Mark Applied button", () => {
    const text = readRealDom("elementsFromPoint.txt");
    const lines = text.trim().split("\n");
    expect(lines[1]).toMatch(/^BUTTON\.p-2/);
    expect(text).toContain("DIV.absolute top-0 right-0 z-10");
    expect(text).toContain("DIV.flex justify-between items-end");
    expect(text).toContain("DIV.absolute bottom-0 w-full p-2 h-full");
    expect(text).toContain("cursor-zoom-in");
    expect(text).toContain("relative bg-white rounded-xl border");
    expect(lines.slice(1).every((line) => line.includes("a=none"))).toBe(true);
    expect(text).not.toMatch(/\ba=(?!none)/);
  });

  test("diagnostics.txt is the live miss: justify-between hit, overlay=no, candidates=none", () => {
    const text = readRealDom("diagnostics.txt");
    expect(text).toContain("hover missed overlay");
    expect(text).toContain("hit=DIV.flex.justify-between.items-end");
    expect(text).toContain("overlay=no");
    expect(text).toContain("candidates=none");
    expect(text).toContain("319.75x416.5");
    expect(text).toContain("viewport=1534x1049");
    expect(text).toContain("0 skipped (applied)");
  });

  test("diagnostics-264-265.txt records the applied-skip miss on v2.5.11 and v2.5.12", () => {
    const text = readRealDom("diagnostics-264-265.txt");
    expect(text).toContain("run-264");
    expect(text).toContain("0 skipped (applied)");
    expect(text).toContain("run-265");
    expect(text).toContain("44 skipped (applied)");
    expect(text).toContain("hover missed overlay");
    expect(text).toContain("hit=DIV.flex.justify-between");
  });
});
