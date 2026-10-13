import { describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";

import { hoverAt, hoverClickInDocument, pickMatch } from "./hoverClick.js";

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

  test("clicks a live Mark Applied button that is not div.bg-white", () => {
    const document = parseHTML(`<!DOCTYPE html><html><body>
      <div data-testid="job-results"><div class="hc-card-grid">
        <div>
          <a href="/job/help-desk-coordinator-reqaaa1111111111">Job Posting</a>
          <button class="p-2 bg-white hover:bg-gray-100 rounded flex-none text-black">Mark Applied</button>
        </div>
      </div></div>
    </body></html>`).document;
    let clicks = 0;
    document.querySelector("button").addEventListener("click", () => {
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

  test("ancestor overlay hit clicks Mark Applied and not the job link", () => {
    const { document } = parseHTML(`<!DOCTYPE html><html><body>
      <div data-testid="job-results"><div class="hc-card-grid">
        <div class="job-card">
          <div class="flex justify-between">
            <a href="/job/help-desk-coordinator-reqaaa1111111111">Job Posting</a>
            <button class="bg-white">Mark Applied</button>
          </div>
        </div>
      </div></div>
    </body></html>`);
    let linkClicks = 0;
    let markClicks = 0;
    document.querySelector("a").addEventListener("click", () => {
      linkClicks += 1;
    });
    document.querySelector("button").addEventListener("click", () => {
      markClicks += 1;
    });
    expect(
      hoverClickInDocument(document, {
        selector: CARD,
        clickSelector: MARK,
        contains: "Mark Applied",
        exact: true,
      }),
    ).toEqual({ found: true, hovered: true });
    expect(markClicks).toBe(1);
    expect(linkClicks).toBe(0);
  });

  test("does not navigate when Mark Applied sits inside a wrapping job link", () => {
    const { document } = parseHTML(`<!DOCTYPE html><html><body>
      <div data-testid="job-results"><div class="hc-card-grid">
        <a href="/job/help-desk-coordinator-reqaaa1111111111">
          <div class="job-card">
            <div class="absolute top-0 right-0">
              <button class="bg-white">Mark Applied</button>
            </div>
          </div>
        </a>
      </div></div>
    </body></html>`);
    const link = document.querySelector("a");
    let markClicks = 0;
    let linkNavigated = false;
    document.querySelector("button").addEventListener("click", () => {
      markClicks += 1;
    });
    link.addEventListener("click", (event) => {
      linkNavigated = !event.defaultPrevented;
    });
    expect(
      hoverClickInDocument(document, {
        selector: "a[href^='/job/'] > div",
        clickSelector: "button",
        contains: "Mark Applied",
        exact: true,
      }),
    ).toEqual({ found: true, hovered: true });
    expect(markClicks).toBe(1);
    expect(linkNavigated).toBe(false);
  });

  test("returns found false when the card or Mark Applied is missing", () => {
    const document = hoverOnlyCard(false);
    expect(hoverClickInDocument(document, { selector: "[data-missing]" })).toEqual({
      found: false,
      hovered: false,
    });
    expect(
      hoverClickInDocument(document, {
        selector: CARD,
        clickSelector: MARK,
        contains: "Save for later",
        exact: true,
      }),
    ).toEqual({ found: false, hovered: true });
  });

  test("pickMatch uses exact or includes text and hoverAt ignores dead nodes", () => {
    const document = hoverOnlyCard(false);
    const nodes = [...document.querySelectorAll("div")];
    expect(pickMatch(nodes, { contains: "Mark Applied", exact: true })?.textContent.trim()).toBe(
      "Mark Applied",
    );
    expect(pickMatch(nodes, { contains: "applied" })?.textContent.trim()).toBe("Mark Applied");
    expect(pickMatch(nodes, { nth: 0 })?.tagName).toBe("DIV");
    hoverAt({ getBoundingClientRect: () => ({ left: 8, top: 12 }) });
    hoverAt({
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
      dispatchEvent: () => {
        throw new Error("no hover");
      },
    });
  });
});
