import { describe, expect, test } from "bun:test";

import {
  POSTED_AT_SOURCE,
  datePostedHasTime,
  postedAgoText,
  postedAtFromAgo,
  resolvePostedAt,
} from "./postedAgo.js";

const NOW = new Date("2026-10-12T18:00:00.000Z");

describe("postedAgoText", () => {
  test("keeps Built In's raw relative stamps", () => {
    expect(postedAgoText("Posted 12 Days Ago")).toBe("Posted 12 Days Ago");
    expect(postedAgoText("Posted 5 Minutes Ago")).toBe("Posted 5 Minutes Ago");
    expect(postedAgoText("3 Hours Ago")).toBe("3 Hours Ago");
    expect(postedAgoText("Yesterday")).toBe("Yesterday");
    expect(postedAgoText("Posted Yesterday")).toBe("Posted Yesterday");
    expect(postedAgoText("Reposted 48 Seconds Ago")).toBe("Reposted 48 Seconds Ago");
    expect(postedAgoText("Just now")).toBe("Just now");
    expect(postedAgoText("  Reposted   2  Weeks  Ago  ")).toBe("Reposted 2 Weeks Ago");
  });

  test("ignores empty or non-relative copy", () => {
    expect(postedAgoText("")).toBe("");
    expect(postedAgoText("2026-10-12")).toBe("");
    expect(postedAgoText("Full-time")).toBe("");
  });
});

describe("datePostedHasTime", () => {
  test("treats a date-only stamp as having no time", () => {
    expect(datePostedHasTime("2026-10-12")).toBe(false);
    expect(datePostedHasTime("")).toBe(false);
  });

  test("detects an ISO or clock time", () => {
    expect(datePostedHasTime("2026-10-12T15:04:05Z")).toBe(true);
    expect(datePostedHasTime("2026-10-12 15:04:05")).toBe(true);
  });
});

describe("postedAtFromAgo", () => {
  test("resolves Posted N Days Ago against the crawl clock", () => {
    expect(postedAtFromAgo("Posted 12 Days Ago", NOW).toISOString()).toBe(
      "2026-09-30T18:00:00.000Z",
    );
  });

  test("resolves minutes ago", () => {
    expect(postedAtFromAgo("Posted 5 Minutes Ago", NOW).toISOString()).toBe(
      "2026-10-12T17:55:00.000Z",
    );
    expect(postedAtFromAgo("X Minutes Ago".replace("X", "20"), NOW).toISOString()).toBe(
      "2026-10-12T17:40:00.000Z",
    );
  });

  test("resolves hours ago", () => {
    expect(postedAtFromAgo("3 Hours Ago", NOW).toISOString()).toBe("2026-10-12T15:00:00.000Z");
    expect(postedAtFromAgo("Posted 1 Hour Ago", NOW).toISOString()).toBe(
      "2026-10-12T17:00:00.000Z",
    );
  });

  test("resolves Yesterday as one day before the crawl clock", () => {
    expect(postedAtFromAgo("Yesterday", NOW).toISOString()).toBe("2026-10-11T18:00:00.000Z");
    expect(postedAtFromAgo("Posted Yesterday", NOW).toISOString()).toBe("2026-10-11T18:00:00.000Z");
  });

  test("resolves Reposted seconds ago", () => {
    expect(postedAtFromAgo("Reposted 48 Seconds Ago", NOW).toISOString()).toBe(
      "2026-10-12T17:59:12.000Z",
    );
  });

  test("resolves just now as the crawl clock", () => {
    expect(postedAtFromAgo("Just now", NOW).toISOString()).toBe(NOW.toISOString());
  });

  test("resolves weeks, months, and years", () => {
    expect(postedAtFromAgo("Posted 2 Weeks Ago", NOW).toISOString()).toBe(
      "2026-09-28T18:00:00.000Z",
    );
    expect(postedAtFromAgo("Posted 1 Month Ago", NOW).toISOString()).toBe(
      "2026-09-12T18:00:00.000Z",
    );
    expect(postedAtFromAgo("Posted 1 Year Ago", NOW).toISOString()).toBe(
      "2025-10-12T18:00:00.000Z",
    );
  });

  test("returns null for copy that is not a relative stamp", () => {
    expect(postedAtFromAgo("2026-10-12", NOW)).toBeNull();
    expect(postedAtFromAgo("", NOW)).toBeNull();
  });
});

describe("resolvePostedAt", () => {
  test("prefers a timed JSON-LD datePosted over inferred ago", () => {
    expect(
      resolvePostedAt({
        datePosted: "2026-10-01T14:30:00Z",
        postedAgo: "Posted 5 Minutes Ago",
        now: NOW,
      }),
    ).toEqual({
      postedAt: "2026-10-01T14:30:00.000Z",
      postedAtSource: POSTED_AT_SOURCE.JSONLD,
    });
  });

  test("uses ago time when date-only JSON-LD and intra-day ago fall on the same UTC date", () => {
    expect(
      resolvePostedAt({
        datePosted: "2026-10-12",
        postedAgo: "Reposted 48 Seconds Ago",
        now: NOW,
      }),
    ).toEqual({
      postedAt: "2026-10-12T17:59:12.000Z",
      postedAtSource: POSTED_AT_SOURCE.JSONLD_AGO,
    });
    expect(
      resolvePostedAt({
        datePosted: "2026-10-12",
        postedAgo: "Posted 5 Minutes Ago",
        now: NOW,
      }),
    ).toEqual({
      postedAt: "2026-10-12T17:55:00.000Z",
      postedAtSource: POSTED_AT_SOURCE.JSONLD_AGO,
    });
    expect(
      resolvePostedAt({
        datePosted: "2026-10-12",
        postedAgo: "Reposted 6 Hours Ago",
        now: NOW,
      }),
    ).toEqual({
      postedAt: "2026-10-12T12:00:00.000Z",
      postedAtSource: POSTED_AT_SOURCE.JSONLD_AGO,
    });
  });

  test("keeps date-only midnight when ago is days or crosses the UTC date", () => {
    expect(
      resolvePostedAt({
        datePosted: "2026-10-12",
        postedAgo: "Posted 12 Days Ago",
        now: NOW,
      }),
    ).toEqual({
      postedAt: "2026-10-12T00:00:00.000Z",
      postedAtSource: POSTED_AT_SOURCE.JSONLD,
    });
    expect(
      resolvePostedAt({
        datePosted: "2026-10-12",
        postedAgo: "20 Hours Ago",
        now: NOW,
      }),
    ).toEqual({
      postedAt: "2026-10-12T00:00:00.000Z",
      postedAtSource: POSTED_AT_SOURCE.JSONLD,
    });
  });

  test("uses the relative stamp when JSON-LD has no datePosted", () => {
    expect(
      resolvePostedAt({
        datePosted: "",
        postedAgo: "Posted 5 Minutes Ago",
        now: NOW,
      }),
    ).toEqual({
      postedAt: "2026-10-12T17:55:00.000Z",
      postedAtSource: POSTED_AT_SOURCE.AGO,
    });
  });

  test("returns none when neither source can be parsed", () => {
    expect(resolvePostedAt({ datePosted: "", postedAgo: "Full-time", now: NOW })).toEqual({
      postedAt: "",
      postedAtSource: POSTED_AT_SOURCE.NONE,
    });
  });
});
