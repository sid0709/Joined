import { describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";

import { hoverClickInDocument } from "./hoverClick.js";

const CARD = '[data-testid="job-results"] .hc-card-grid > div';
const MARK = "div.absolute.top-0.right-0 div.bg-white";

function hoverOnlyCard(hidden = true) {
  const hide = hidden ? " hidden" : "";
  return parseHTML(`<!DOCTYPE html><html><body>
    <div data-testid="job-results"><div class="hc-card-grid">
      <div>
        <a href="/job/help-desk-coordinator-reqaaa1111111111">Job Posting</a>
        <div class="absolute top-0 right-0"${hide}>
          <div class="flex items-center space-x-2">
            <div class="flex-none cursor-pointer">Save</div>
            <div class="bg-white">Mark Applied</div>
          </div>
        </div>
      </div>
    </div></div>
  </body></html>`).document;
}

describe("hoverClickInDocument", () => {
  test("clicks Mark Applied next to Save even while the hover overlay is hidden", () => {
    const document = hoverOnlyCard(true);
    const overlay = document.querySelector("div.absolute.top-0.right-0");
    overlay.hidden = true;
    let clicks = 0;
    overlay.querySelector("div.bg-white").addEventListener("click", () => {
      clicks += 1;
    });

    const result = hoverClickInDocument(document, {
      selector: CARD,
      clickSelector: MARK,
      contains: "Mark Applied",
      exact: true,
      offsets: [{ x: 100, y: 100 }],
    });

    expect(result).toEqual({ found: true, hovered: true });
    expect(clicks).toBe(1);
  });

  test("clicks a hover-only Mark Applied that is already in the DOM", () => {
    const document = hoverOnlyCard(false);
    let clicks = 0;
    document.querySelector("div.bg-white").addEventListener("click", () => {
      clicks += 1;
    });
    expect(
      hoverClickInDocument(document, {
        selector: CARD,
        clickSelector: MARK,
        contains: "Mark Applied",
        exact: true,
      }),
    ).toEqual({ found: true, hovered: true });
    expect(clicks).toBe(1);
  });
});
