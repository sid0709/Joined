import { describe, expect, test } from "bun:test";

import { POSTED_AT_SOURCE } from "./constants.js";
import {
  companyLogoFrom,
  companyNameOf,
  companyProfileUrl,
  firstHttpOrWebsite,
  isoDate,
  postedFrom,
  socialLinks,
  websiteUrl,
} from "./values.js";

describe("HiringCafe value helpers", () => {
  test("turns a bare domain into an https website and a profile URL", () => {
    expect(websiteUrl("texaspetroleumgroup.com")).toBe("https://texaspetroleumgroup.com");
    expect(websiteUrl("https://acme.example/about")).toBe("https://acme.example/about");
    expect(websiteUrl("not a host")).toBe("");
    expect(firstHttpOrWebsite("acme.example", "https://other.example")).toBe(
      "https://acme.example",
    );
    expect(companyProfileUrl({ enriched_company_data: { external_id: "v08why2" } })).toBe(
      "https://hiringcafe.com/company/v08why2",
    );
    expect(companyProfileUrl({})).toBe("");
    expect(companyNameOf({ name: "Acme" })).toBe("Acme");
    expect(companyNameOf("[object Object]")).toBe("");
  });

  test("prefers a real logo over a Google favicon", () => {
    expect(
      companyLogoFrom(
        "https://s2.googleusercontent.com/s2/favicons?domain=acme.example&sz=128",
        "https://cdn.example/logo.png",
      ),
    ).toBe("https://cdn.example/logo.png");
  });

  test("stores ISO posted dates and names the source", () => {
    expect(isoDate("2026-10-12T18:03:03.455Z")).toBe("2026-10-12T18:03:03.455Z");
    expect(isoDate("nope")).toBe("");
    expect(postedFrom({ estimated_publish_date: "2026-10-12T18:03:03.455Z" }, "", "3h")).toEqual({
      postedAt: "2026-10-12T18:03:03.455Z",
      postedAgo: "3h",
      postedAtSource: POSTED_AT_SOURCE.ESTIMATED_PUBLISH_DATE,
    });
    expect(postedFrom({}, "2026-10-11", "")).toMatchObject({
      postedAtSource: POSTED_AT_SOURCE.JSON_LD,
    });
    expect(postedFrom({}, "", "Posted 3h ago")).toEqual({
      postedAt: "Posted 3h ago",
      postedAgo: "Posted 3h ago",
      postedAtSource: POSTED_AT_SOURCE.DOM,
    });
  });

  test("collects socials when a company object has them", () => {
    expect(
      socialLinks({
        enriched_company_data: { linkedin: "https://linkedin.com/company/acme" },
        attributed_org: { twitter: "https://x.com/acme" },
      }),
    ).toEqual({
      linkedin: "https://linkedin.com/company/acme",
      x: "https://x.com/acme",
    });
    expect(socialLinks({})).toEqual({});
  });
});
