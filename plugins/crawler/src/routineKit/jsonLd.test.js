import { describe, expect, test } from "bun:test";

import { parseJobPostingJsonLd } from "./jsonLd.js";
import "./testing/domParser.js";

describe("parseJobPostingJsonLd", () => {
  test("walks a graph and ignores invalid scripts", () => {
    const html = `
      <script type="application/ld+json">not-json</script>
      <script type="text/plain">{"@type":"JobPosting","title":"Nope"}</script>
      <script type="application/ld+json">
        {"@graph":[{"@type":["Thing","JobPosting"],"title":"Engineer","hiringOrganization":{"name":"Acme"}}]}
      </script>
    `;
    expect(parseJobPostingJsonLd(html)?.title).toBe("Engineer");
    expect(parseJobPostingJsonLd("<html></html>")).toBeNull();
  });
});
