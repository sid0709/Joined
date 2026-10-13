import { afterEach, describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";

import { installMarkLinkGuard, releaseMarkLinkGuard } from "./markLinkGuard.js";

afterEach(() => {
  releaseMarkLinkGuard();
});

function wrapCardDocument() {
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
  return document;
}

describe("installMarkLinkGuard", () => {
  test("preventDefault on the wrap still lets a document-level listener fire", () => {
    const document = wrapCardDocument();
    const button = document.querySelector("button");
    let documentClicks = 0;
    let defaultPreventedAtDocument = false;
    document.addEventListener("click", (event) => {
      documentClicks += 1;
      defaultPreventedAtDocument = event.defaultPrevented;
    });
    expect(
      installMarkLinkGuard(document, {
        selector: "a[href^='/job/'] > div",
        clickSelector: "button",
        contains: "Mark Applied",
        exact: true,
      }),
    ).toEqual({ guarded: true });
    button.click();
    expect(documentClicks).toBe(1);
    expect(defaultPreventedAtDocument).toBe(true);
  });

  test("releases the listener even when the click throws", () => {
    const document = wrapCardDocument();
    const link = document.querySelector("a");
    const button = document.querySelector("button");
    const added = [];
    const removed = [];
    const nativeAdd = link.addEventListener.bind(link);
    const nativeRemove = link.removeEventListener.bind(link);
    link.addEventListener = (type, fn, options) => {
      added.push(fn);
      return nativeAdd(type, fn, options);
    };
    link.removeEventListener = (type, fn, options) => {
      removed.push(fn);
      return nativeRemove(type, fn, options);
    };
    installMarkLinkGuard(document, {
      selector: "a[href^='/job/'] > div",
      contains: "Mark Applied",
      exact: true,
    });
    try {
      throw new Error("click failed");
    } catch {
      releaseMarkLinkGuard();
    }
    expect(removed).toEqual(added);
    let leftoverPrevented = false;
    document.addEventListener("click", (event) => {
      leftoverPrevented = event.defaultPrevented;
    });
    button.click();
    expect(leftoverPrevented).toBe(false);
  });

  test("returns unguarded when Mark Applied is missing", () => {
    const { document } = parseHTML(
      `<!DOCTYPE html><html><body><div class="card"></div></body></html>`,
    );
    expect(installMarkLinkGuard(document, { selector: ".card", contains: "Mark Applied" })).toEqual(
      {
        guarded: false,
      },
    );
  });
});
