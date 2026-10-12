import { describe, expect, test } from "bun:test";

import { VIEW_ALL_TEXT } from "./constants.js";
import { expandShortGroups } from "./expandGroups.js";
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

describe("expandShortGroups", () => {
  test("clicks View all and recovers the fourth Interim posting", async () => {
    const truncated = listPageHtml({
      hits: interimHits().slice(0, 3),
      cards: [cardMarkup(INTERIM_JOBS[0].path, "35m", { carousel: carouselMarkup(4, 1) })],
    });
    const opened = listPageHtml({
      hits: interimHits().slice(0, 3),
      cards: [cardMarkup(INTERIM_JOBS[0].path, "35m", { carousel: carouselMarkup(4, 1) })],
      viewAll: viewAllDialogMarkup(INTERIM_JOBS),
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
});
