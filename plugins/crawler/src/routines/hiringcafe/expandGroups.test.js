import { describe, expect, test } from "bun:test";

import { PAGE_DELAY_MS, VIEW_ALL_CONTROL, VIEW_ALL_TEXT } from "./constants.js";
import { expandShortGroups, jobLinksFrom, viewAllJobLinks } from "./expandGroups.js";
import { parseList } from "./parseList.js";
import {
  INTERIM_JOBS,
  cardMarkup,
  carouselMarkup,
  interimHits,
  listPageHtml,
  viewAllDialogMarkup,
} from "./testing/pageHtml.js";
import "./testing/domParser.js";

const LIST_URL = "https://hiringcafe.com/classic";

describe("jobLinksFrom", () => {
  test("dedupes links inside a root selector and ignores empty html", () => {
    const html = `<div id="card"><a href="${INTERIM_JOBS[0].path}">One</a><a href="${INTERIM_JOBS[0].path}">Dup</a></div><a href="${INTERIM_JOBS[1].path}">Outside</a>`;
    expect(jobLinksFrom("", LIST_URL)).toEqual([]);
    expect(jobLinksFrom(html, LIST_URL, "#card")).toEqual([
      expect.objectContaining({
        id: INTERIM_JOBS[0].requisitionId,
        url: `https://hiringcafe.com${INTERIM_JOBS[0].path}`,
      }),
    ]);
  });
});

describe("viewAllJobLinks", () => {
  test("reads job hrefs from the card's own View all dialog", () => {
    const own = viewAllDialogMarkup(INTERIM_JOBS.slice(0, 2));
    const sibling = viewAllDialogMarkup([
      {
        path: "/job/other-role-zzzzzzzzzzzzzzzz",
        title: "Other",
        requisitionId: "zzzzzzzzzzzzzzzz",
      },
    ]);
    const html = listPageHtml({
      hits: interimHits().slice(0, 3),
      cards: [
        cardMarkup(INTERIM_JOBS[0].path, "35m", {
          carousel: carouselMarkup(4, 1),
          viewAll: own,
        }),
        cardMarkup("/job/other-role-zzzzzzzzzzzzzzzz", "1h", { viewAll: sibling }),
      ],
    });
    const host = {
      id: INTERIM_JOBS[0].requisitionId,
      url: `https://hiringcafe.com${INTERIM_JOBS[0].path}`,
    };
    expect(viewAllJobLinks(html, LIST_URL, host).map((link) => link.id)).toEqual(
      INTERIM_JOBS.slice(0, 2).map((job) => job.requisitionId),
    );
    expect(
      viewAllJobLinks(html, LIST_URL, host).some((link) => link.id === "zzzzzzzzzzzzzzzz"),
    ).toBe(false);
  });
});

describe("expandShortGroups", () => {
  test("returns parsed unchanged when expansion cannot run", async () => {
    const parsed = parseList(listPageHtml({ hits: interimHits() }), LIST_URL);
    expect(parsed.shortfalls).toEqual([]);
    expect(await expandShortGroups()).toBeUndefined();
    expect(
      await expandShortGroups({ parsed, call: async () => {}, readPage: async () => ({}) }),
    ).toBe(parsed);
    const missingHost = {
      ...parsed,
      shortfalls: [{ collapseKey: "missing-group", dots: 2 }],
    };
    expect(
      await expandShortGroups({
        parsed: missingHost,
        pageUrl: LIST_URL,
        skipDelays: true,
        readPage: async () => ({ html: "", url: LIST_URL }),
        call: async () => ({ found: true }),
      }),
    ).toBe(missingHost);
  });

  test("clicks View all and recovers the fourth Interim posting", async () => {
    const truncated = listPageHtml({
      hits: interimHits().slice(0, 3),
      cards: [cardMarkup(INTERIM_JOBS[0].path, "35m", { carousel: carouselMarkup(4, 1) })],
    });
    const opened = listPageHtml({
      hits: interimHits().slice(0, 3),
      cards: [
        cardMarkup(INTERIM_JOBS[0].path, "35m", {
          carousel: carouselMarkup(4, 1),
          viewAll: viewAllDialogMarkup(INTERIM_JOBS),
        }),
      ],
    });
    const clicks = [];
    let html = truncated;
    const parsed = parseList(truncated, LIST_URL);
    expect(parsed.jobs).toHaveLength(3);
    expect(parsed.shortfalls[0].dots).toBe(4);

    const expanded = await expandShortGroups({
      parsed,
      pageUrl: LIST_URL,
      skipDelays: true,
      readPage: async () => ({ html, url: LIST_URL }),
      call: async (op, payload = {}) => {
        clicks.push({ op, ...payload });
        if (op === "click" && payload.contains === VIEW_ALL_TEXT) html = opened;
        return { found: true };
      },
    });

    expect(clicks.some((click) => click.contains === VIEW_ALL_TEXT)).toBe(true);
    expect(expanded.jobs.map((job) => job.id)).toEqual(
      INTERIM_JOBS.map((job) => job.requisitionId),
    );
    expect(expanded.jobs.map((job) => job.title)).toContain(
      "Community Support Worker III - MCHOME",
    );
    expect(expanded.jobs[3].url).toContain(
      "/job/community-support-worker-iii-mchome-interim-inc-salinas-california-bhzhzp7x4upf48f0",
    );
    expect(expanded.shortfalls).toEqual([]);
  });

  test("scopes extra links to the group and navigates back if View all left the list", async () => {
    const siblingPath = "/job/unrelated-role-zzzzzzzzzzzzzzzz";
    const strayPath = "/job/stray-page-link-yyyyyyyyyyyyyyyy";
    const truncated = listPageHtml({
      hits: interimHits().slice(0, 3),
      cards: [cardMarkup(INTERIM_JOBS[0].path, "35m", { carousel: carouselMarkup(4, 1) })],
    });
    const opened = listPageHtml({
      hits: interimHits().slice(0, 3),
      cards: [
        cardMarkup(INTERIM_JOBS[0].path, "35m", {
          carousel: carouselMarkup(4, 1),
          viewAll: viewAllDialogMarkup(INTERIM_JOBS),
        }),
        cardMarkup(siblingPath, "1h", {
          viewAll: `${viewAllDialogMarkup([
            { path: siblingPath, title: "Unrelated", requisitionId: "zzzzzzzzzzzzzzzz" },
          ])}<a href="${strayPath}">Stray</a>`,
        }),
      ],
    });
    const parsed = parseList(truncated, LIST_URL);
    expect(parsed.jobs).toHaveLength(3);
    expect(parsed.shortfalls[0].dots).toBe(4);

    let html = truncated;
    let url = LIST_URL;
    const ops = [];
    const expanded = await expandShortGroups({
      parsed,
      pageUrl: LIST_URL,
      skipDelays: true,
      readPage: async () => ({ html, url }),
      call: async (op, payload = {}) => {
        ops.push({ op, ...payload });
        if (op === "click" && payload.contains === VIEW_ALL_TEXT) {
          url = `https://hiringcafe.com${INTERIM_JOBS[3].path}`;
          html = `<html><body><a href="${INTERIM_JOBS[3].path}">left the list</a></body></html>`;
        }
        if (op === "navigate") {
          url = payload.url;
          html = opened;
        }
        return { found: true };
      },
    });

    const viewAll = ops.find((entry) => entry.contains === VIEW_ALL_TEXT);
    expect(viewAll?.selector.endsWith(` ${VIEW_ALL_CONTROL}`)).toBe(true);
    expect(ops.some((entry) => entry.op === "navigate" && entry.url === LIST_URL)).toBe(true);
    expect(expanded.jobs.map((job) => job.id)).toEqual(
      INTERIM_JOBS.map((job) => job.requisitionId),
    );
    expect(expanded.jobs.some((job) => job.id === "zzzzzzzzzzzzzzzz")).toBe(false);
    expect(expanded.jobs.some((job) => job.id === "yyyyyyyyyyyyyyyy")).toBe(false);
  });

  test("keeps the parsed list when Show job and View all clicks fail", async () => {
    const truncated = listPageHtml({
      hits: interimHits().slice(0, 3),
      cards: [cardMarkup(INTERIM_JOBS[0].path, "35m", { carousel: carouselMarkup(4, 1) })],
    });
    const parsed = parseList(truncated, LIST_URL);
    const expanded = await expandShortGroups({
      parsed,
      pageUrl: LIST_URL,
      skipDelays: true,
      readPage: async () => ({ html: truncated, url: LIST_URL }),
      call: async () => {
        throw new Error("overlay gone");
      },
    });
    expect(expanded.jobs.map((job) => job.id)).toEqual(parsed.jobs.map((job) => job.id));
  });

  test("rests between UI steps when delays are enabled", async () => {
    const truncated = listPageHtml({
      hits: interimHits().slice(0, 3),
      cards: [cardMarkup(INTERIM_JOBS[0].path, "35m", { carousel: carouselMarkup(4, 1) })],
    });
    const opened = listPageHtml({
      hits: interimHits().slice(0, 3),
      cards: [
        cardMarkup(INTERIM_JOBS[0].path, "35m", {
          carousel: carouselMarkup(4, 1),
          viewAll: viewAllDialogMarkup(INTERIM_JOBS),
        }),
      ],
    });
    const parsed = parseList(truncated, LIST_URL);
    let html = truncated;
    let url = LIST_URL;
    const rested = [];
    await expandShortGroups({
      parsed,
      pageUrl: LIST_URL,
      skipDelays: false,
      rest: async (ms) => {
        rested.push(ms);
      },
      readPage: async () => ({ html, url }),
      call: async (op, payload = {}) => {
        if (op === "click" && payload.contains === VIEW_ALL_TEXT) {
          url = `https://hiringcafe.com${INTERIM_JOBS[3].path}`;
          html = `<html><body><a href="${INTERIM_JOBS[3].path}">left the list</a></body></html>`;
        }
        if (op === "navigate") {
          url = payload.url;
          html = opened;
        }
        return { found: true };
      },
    });
    expect(rested.length).toBeGreaterThan(0);
    expect(rested).toContain(PAGE_DELAY_MS.min);
  });
});
