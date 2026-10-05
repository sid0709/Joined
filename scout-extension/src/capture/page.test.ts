import { describe, expect, test } from "bun:test";

import { parseHtmlDocument } from "./html-document";
import {
  elementMultiline,
  elementText,
  firstAttribute,
  firstMatching,
  firstMultiline,
  normalizeMultiline,
  stripHtml,
} from "./page";

describe("page text helpers", () => {
  test("normalizes, strips html, and reads attributes", () => {
    const root = parseHtmlDocument(`
      <div id="job">
        <p>Line one</p>
        <p>Line two</p>
        <img data-name="Acme" alt="Acme" />
      </div>
    `);
    expect(elementText(null)).toBe("");
    expect(elementMultiline(null)).toBe("");
    expect(firstMatching(root, [".missing", "#job"])?.getAttribute("id")).toBe("job");
    expect(firstAttribute(root, ["img"], "alt")).toBe("Acme");
    expect(firstMultiline(root, ["#job"])).toContain("Line one");
    expect(normalizeMultiline("a  \n\n\nb")).toBe("a\n\nb");
    expect(stripHtml("<b>Bold</b>")).toBe("Bold");
  });
});
