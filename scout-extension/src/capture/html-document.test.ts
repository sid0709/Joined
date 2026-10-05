import { describe, expect, test } from "bun:test";

import { parseCompoundSelector, parseHtmlDocument } from "./html-document";
import { loadFixtureDocument, readFixtureHtml } from "./load-fixture";
import { decodeHtmlEntities, firstHref, firstText, resolvePageUrl } from "./page";

describe("html fixture document", () => {
  test("parses comments, void tags, entities, and script text", () => {
    const root = parseHtmlDocument(`
      <!DOCTYPE html>
      <!-- skip me -->
      <div id="box" class="card featured" data-qa="job-description">
        Hello&nbsp;&amp; welcome
        <img src="/x.png" alt="Logo" />
        <a href="/apply">Apply</a>
      </div>
      <script type="application/ld+json">{"@type":"JobPosting"}</script>
    `);
    expect(firstText(root, ["#box"])).toBe("Hello & welcome Apply");
    expect(root.querySelector("img")?.getAttribute("alt")).toBe("Logo");
    expect(firstHref(root, ['a[href*="/apply"]'], "https://jobs.lever.co/acme/1")).toBe(
      "https://jobs.lever.co/apply",
    );
    expect(root.querySelector('script[type="application/ld+json"]')?.textContent).toContain(
      "JobPosting",
    );
    expect(root.querySelectorAll(".card").length).toBe(1);
    expect(root.querySelector("[missing]")).toBeNull();
  });

  test("parses compound selectors used by the extractors", () => {
    expect(parseCompoundSelector("h1.app-title")).toEqual({
      tag: "h1",
      classes: ["app-title"],
      attrs: [],
    });
    expect(parseCompoundSelector("#header")).toEqual({ id: "header", classes: [], attrs: [] });
    expect(parseCompoundSelector('[data-automation-id="jobPostingHeader"]')).toEqual({
      classes: [],
      attrs: [{ name: "data-automation-id", op: "exact", value: "jobPostingHeader" }],
    });
    expect(parseCompoundSelector('[class*="ashby-job-posting-heading"]')).toEqual({
      classes: [],
      attrs: [{ name: "class", op: "contains", value: "ashby-job-posting-heading" }],
    });
  });

  test("loads saved fixtures from disk", () => {
    expect(readFixtureHtml("greenhouse.html")).toContain("app-title");
    expect(loadFixtureDocument("no-job.html").querySelector("h1")?.textContent).toContain(
      "How we ship weekly",
    );
    expect(decodeHtmlEntities("&lt;x&gt;&#39;&apos;&quot;")).toBe("<x>''\"");
    expect(resolvePageUrl("https://already.test/a", "https://example.test")).toBe(
      "https://already.test/a",
    );
    expect(resolvePageUrl("::", "not-a-base")).toBe("::");
  });
});
