import { describe, expect, test } from "bun:test";

import { documentFromHtml } from "./html.js";
import {
  cardIdKey,
  crawlListUrl,
  exactJobsListUrl,
  listUrlForPage,
  pageFromListUrl,
} from "./lists.js";
import { parseList, parseNextPageUrl } from "./parseList.js";
import { installDomParser } from "./testing/domParser.js";
import { loadFixture } from "./testing/loadFixture.js";

const LIST_URL = "https://builtin.com/jobs";

describe("parseList", () => {
  test("reads job cards and the next-page link", () => {
    const parsed = parseList(loadFixture("list.html"), LIST_URL);
    expect(parsed.cards.map((card) => card.id)).toEqual(["9256204", "11111111"]);
    expect(parsed.cards[0]).toMatchObject({
      title: "Staff/ Principal Engineer, OCT MTE Material Engineering",
      companyName: "Micron Technology",
      url: "https://builtin.com/job/staff-principal-engineer-oct-mte-material-engineering/9256204",
    });
    expect(parsed.cards[0].logo).toContain("cdn.builtin.com");
    expect(parsed.nextPageUrl).toBe("https://builtin.com/jobs?page=2");
    expect(parsed.hasNextPage).toBe(true);
    expect(parsed.isLastPage).toBe(false);
    expect(parsed.board.categoriesFilterOptions.map((item) => item.alias)).toEqual([
      "ai-machine-learning",
      "consultant",
      "customer-success-experience",
    ]);
  });

  test("treats a missing next link as the last page", () => {
    const parsed = parseList(loadFixture("list-last.html"), LIST_URL);
    expect(parsed.cards).toHaveLength(1);
    expect(parsed.nextPageUrl).toBeNull();
    expect(parsed.hasNextPage).toBe(false);
    expect(parsed.isLastPage).toBe(true);
    expect(parseNextPageUrl(documentFromHtml(loadFixture("list-last.html")), LIST_URL)).toBeNull();
  });

  test("treats zero cards as the last page even when pagination is present", () => {
    const parsed = parseList(loadFixture("list-empty.html"), LIST_URL);
    expect(parsed.cards).toHaveLength(0);
    expect(parsed.isLastPage).toBe(true);
  });

  test("reads save-host and visible Saved-badge flags from the live card shapes", () => {
    const unsaved = parseList(loadFixture("list.html"), LIST_URL);
    expect(unsaved.cards).toHaveLength(2);
    expect(unsaved.cards.every((card) => card.hasSaveHost)).toBe(true);
    expect(unsaved.cards.every((card) => card.hasVisibleSavedBadge)).toBe(false);

    const saved = parseList(loadFixture("list-saved.html"), LIST_URL);
    expect(saved.cards[0]).toMatchObject({
      id: "22222222",
      hasSaveHost: false,
      hasVisibleSavedBadge: true,
    });
    expect(loadFixture("list-saved.html")).not.toContain("<my-item");

    const unknown = parseList(loadFixture("list-unknown.html"), LIST_URL);
    expect(unknown.cards[0]).toMatchObject({
      id: "9256204",
      hasSaveHost: false,
      hasVisibleSavedBadge: false,
    });
    expect(loadFixture("list-unknown.html")).toContain('style="display: none;"');
  });

  test("builds the current-tab list URL and page cursor", () => {
    expect(listUrlForPage("https://builtin.com/jobs", 1)).toBe("https://builtin.com/jobs");
    expect(listUrlForPage("https://builtin.com/jobs", 3)).toBe("https://builtin.com/jobs?page=3");
    expect(pageFromListUrl("https://builtin.com/jobs?page=4")).toBe(4);
    expect(pageFromListUrl("https://builtin.com/jobs")).toBe(1);
    expect(cardIdKey([{ id: "b" }, { id: "a" }, { id: "a" }])).toBe("a\nb");
    expect(crawlListUrl("https://www.builtin.com/jobs/remote?page=3")).toBe(
      "https://www.builtin.com/jobs/remote",
    );
    expect(crawlListUrl("https://builtin.com/job/x/1")).toBe("https://builtin.com/jobs");
    expect(
      exactJobsListUrl(
        "https://builtin.com/jobs?daysSinceUpdated=1&city=&state=&country=USA&allLocations=true",
      ),
    ).toBe(
      "https://builtin.com/jobs?daysSinceUpdated=1&city=&state=&country=USA&allLocations=true",
    );
  });

  test("installs DOMParser when missing", () => {
    const previous = globalThis.DOMParser;
    globalThis.DOMParser = undefined;
    installDomParser();
    const document = new globalThis.DOMParser().parseFromString("<p>ok</p>", "text/html");
    expect(document.querySelector("p")?.textContent).toBe("ok");
    installDomParser();
    globalThis.DOMParser = previous;
  });
});
