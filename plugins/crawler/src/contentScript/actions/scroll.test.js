import { describe, expect, test } from "bun:test";

import { SCROLL_BLOCK, SCROLL_INLINE } from "../../routines/builtin/constants.js";
import { documentFromHtml } from "../../routines/builtin/html.js";
import "../../routines/builtin/testing/domParser.js";

import { scrollElementIntoView } from "./scroll.js";

describe("scrollElementIntoView", () => {
  test("scrolls the first match to the named block", () => {
    const document = documentFromHtml(`<div id="job-card-1">card</div>`);
    const node = document.getElementById("job-card-1");
    const calls = [];
    node.scrollIntoView = (opts) => calls.push(opts);
    expect(scrollElementIntoView(document, { selector: "#job-card-1" })).toEqual({ found: true });
    expect(calls).toEqual([{ block: SCROLL_BLOCK, inline: SCROLL_INLINE }]);
    expect(scrollElementIntoView(document, { selector: "#missing" })).toEqual({ found: false });
  });
});
