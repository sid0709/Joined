import { describe, expect, test } from "bun:test";

import { displayPage, jobCardSelector, resumeLabelFromCursor } from "./constants.js";
import { isHiringCafeHost, isHiringCafeUrl } from "./html.js";
import {
  crawlListUrl,
  emptyCursor,
  isClassicListUrl,
  isJobDetailUrl,
  jobUrlFromHit,
  listUrlForPage,
  pageFromListUrl,
} from "./lists.js";
import { parseList, requisitionIdFromHref } from "./parseList.js";
import { cardMarkup, carouselMarkup, groupedHits, listPageHtml } from "./testing/pageHtml.js";
import "./testing/domParser.js";

const LIST_URL = "https://hiringcafe.com/classic";

describe("parseList grouping", () => {
  test("enumerates every ssrHits posting, not just the visible cards", () => {
    const hits = groupedHits();
    const parsed = parseList(listPageHtml({ hits }), LIST_URL);
    expect(parsed.cardCount).toBe(2);
    expect(parsed.jobs).toHaveLength(4);
    expect(parsed.jobs.map((job) => job.id)).toEqual([
      "reqaaa1111111111",
      "reqbbb2222222222",
      "reqccc3333333333",
      "reqddd4444444444",
    ]);
    expect(parsed.groups).toHaveLength(2);
    expect(parsed.groups[0].hits).toHaveLength(3);
    expect(parsed.jobs[0].url).toContain("/job/help-desk-coordinator-reqaaa1111111111");
    expect(parsed.jobs[0].cardHref).toContain("/job/help-desk-coordinator-reqaaa1111111111");
    expect(parsed.jobs[1].url).toContain("/job/associate-category-manager-reqbbb2222222222");
    expect(parsed.jobs[1].cardHref).toContain("/job/help-desk-coordinator-reqaaa1111111111");
    expect(jobCardSelector(parsed.jobs[1])).toContain(
      'href$="/job/help-desk-coordinator-reqaaa1111111111"',
    );
    expect(parsed.jobs[0].groupIndex).toBe(1);
    expect(parsed.jobs[1].groupIndex).toBe(2);
    expect(parsed.jobs[0].groupSize).toBe(3);
    expect(parsed.jobs[0].groupIds).toEqual([
      "reqaaa1111111111",
      "reqbbb2222222222",
      "reqccc3333333333",
    ]);
    expect(parsed.signedIn).toBe(true);
    expect(parsed.page).toBe(0);
    expect(parsed.isLastPage).toBe(false);
    expect(parsed.nextPage).toBe(1);
  });

  test("builds the card selector from the live href, not a title slug", () => {
    const parsed = parseList(
      listPageHtml({
        hits: groupedHits(),
        cards: [
          cardMarkup("/job/help-desk-coord-i-reqaaa1111111111", "3h", {
            carousel: carouselMarkup(3, 1),
          }),
          cardMarkup("/job/labor-production-reqddd4444444444", "5h"),
        ],
      }),
      LIST_URL,
    );
    expect(parsed.jobs[0].path).toBe("/job/help-desk-coord-i-reqaaa1111111111");
    expect(parsed.jobs[0].cardHref).toContain("/job/help-desk-coord-i-reqaaa1111111111");
    expect(jobCardSelector(parsed.jobs[0])).toContain(
      'href$="/job/help-desk-coord-i-reqaaa1111111111"',
    );
    expect(jobCardSelector(parsed.jobs[0])).not.toContain("help-desk-coordinator-reqaaa");
    expect(jobCardSelector(parsed.jobs[1])).toContain(
      'href$="/job/help-desk-coord-i-reqaaa1111111111"',
    );
  });

  test("uses requisition_id as the job id and keeps later grouped hits", () => {
    const parsed = parseList(listPageHtml(), LIST_URL);
    expect(parsed.jobs.every((job) => /^req[a-z0-9]+$/.test(job.id))).toBe(true);
    expect(new Set(parsed.jobs.map((job) => job.collapseKey)).size).toBe(2);
    expect(
      parsed.jobs.filter((job) => job.collapseKey === parsed.jobs[0].collapseKey),
    ).toHaveLength(3);
  });

  test("warns when a card has more dots than captured jobs", () => {
    const parsed = parseList(
      listPageHtml({
        hits: groupedHits(),
        cards: [
          cardMarkup("/job/help-desk-coordinator-reqaaa1111111111", "3h", {
            carousel: carouselMarkup(4, 1),
          }),
          cardMarkup("/job/labor-production-reqddd4444444444", "5h"),
        ],
      }),
      LIST_URL,
    );
    expect(parsed.jobs[0].cardDots).toBe(4);
    expect(
      parsed.jobs.filter((job) => job.collapseKey === parsed.jobs[0].collapseKey),
    ).toHaveLength(3);
    expect(parsed.shortfalls).toEqual([
      expect.objectContaining({
        collapseKey: parsed.jobs[0].collapseKey,
        captured: 3,
        dots: 4,
      }),
    ]);
    expect(parsed.shortfalls[0].label).toContain("4 dots");
  });

  test("merges extra pageProps hit arrays when ssrHits is short", () => {
    const extra = groupedHits()[2];
    const parsed = parseList(
      listPageHtml({
        hits: groupedHits().slice(0, 2),
        extraHits: [extra],
      }),
      LIST_URL,
    );
    expect(parsed.jobs.map((job) => job.id)).toContain(extra.requisition_id);
  });

  test("treats only ssrIsLastPage as the last page", () => {
    const last = parseList(listPageHtml({ hits: groupedHits(), ssrIsLastPage: true }), LIST_URL);
    expect(last.isLastPage).toBe(true);
    expect(last.nextPage).toBeNull();
    const empty = parseList(listPageHtml({ hits: [], ssrPage: 9, ssrIsLastPage: false }), LIST_URL);
    expect(empty.jobs).toHaveLength(0);
    expect(empty.isLastPage).toBe(false);
    expect(empty.nextPage).toBe(10);
  });

  test("reads the 0-indexed page cursor from the list URL", () => {
    expect(listUrlForPage(LIST_URL, 0)).toBe("https://hiringcafe.com/classic");
    expect(listUrlForPage(LIST_URL, 4)).toBe("https://hiringcafe.com/classic?page=4");
    expect(pageFromListUrl("https://hiringcafe.com/classic?page=4")).toBe(4);
    expect(pageFromListUrl("https://hiringcafe.com/classic")).toBe(0);
    expect(displayPage(0)).toBe(1);
    expect(displayPage(4)).toBe(5);
    expect(crawlListUrl("https://www.hiringcafe.com/classic?page=3")).toBe(
      "https://www.hiringcafe.com/classic",
    );
    expect(crawlListUrl("https://hiringcafe.com/job/x-reqaaa1111111111")).toBe(
      "https://hiringcafe.com/classic",
    );
    expect(requisitionIdFromHref("/job/help-desk-coordinator-reqaaa1111111111")).toBe(
      "reqaaa1111111111",
    );
    expect(
      resumeLabelFromCursor({ lists: [LIST_URL], page: 4, lastJobId: "reqaaa1111111111" }),
    ).toBe("Resume from page 5 · reqaaa1111111111");
    expect(resumeLabelFromCursor({ lists: [LIST_URL], page: 0, lastJobId: "" })).toBe(
      "Resume from page 1",
    );
    expect(isClassicListUrl(LIST_URL)).toBe(true);
    expect(isJobDetailUrl("https://hiringcafe.com/job/x-reqaaa1111111111")).toBe(true);
    expect(isHiringCafeHost("www.hiringcafe.com")).toBe(true);
    expect(isHiringCafeUrl("https://hiring.cafe/classic")).toBe(true);
    expect(isHiringCafeUrl("not a url")).toBe(false);
    expect(isClassicListUrl("not a url")).toBe(false);
    expect(isJobDetailUrl("not a url")).toBe(false);
    expect(pageFromListUrl("not a url")).toBe(0);
    expect(jobUrlFromHit({ path: "" }, LIST_URL)).toBe("");
    expect(crawlListUrl("https://hiringcafe.com/classic?searchState=%7B%7D&page=2")).toContain(
      "searchState=",
    );
    expect(emptyCursor([LIST_URL]).page).toBe(0);
    expect(jobUrlFromHit({ path: "/job/x-reqaaa1111111111" }, LIST_URL)).toBe(
      "https://hiringcafe.com/job/x-reqaaa1111111111",
    );
  });
});
