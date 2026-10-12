import { describe, expect, test } from "bun:test";

import {
  companyLinkFrom,
  companyProfileUrlFrom,
  companySocialsFrom,
  companyWebsiteFrom,
  isBuiltinCompanyUrl,
} from "./companyLinks.js";
import { documentFromHtml } from "./html.js";
import "./testing/domParser.js";

const PAGE = "https://builtin.com/job/staff-engineer/9256204";
const ORG = {
  url: "https://www.micron.com/",
  sameAs: "https://builtin.com/company/micron-technology",
};

function page(body, org = ORG) {
  const document = documentFromHtml(`<!DOCTYPE html><html><body>${body}</body></html>`);
  return { document, org };
}

describe("companyProfileUrlFrom", () => {
  test("makes the first job-page /company/ href absolute", () => {
    const { document, org } = page(`<a href="/company/micron-technology">Micron Technology</a>`);
    expect(companyProfileUrlFrom(document, org, PAGE)).toBe(
      "https://builtin.com/company/micron-technology",
    );
  });

  test("falls back to JSON-LD sameAs when the page has no /company/ link", () => {
    const { document, org } = page("");
    expect(companyProfileUrlFrom(document, org, PAGE)).toBe(
      "https://builtin.com/company/micron-technology",
    );
  });
});

describe("companyWebsiteFrom", () => {
  test("uses hiringOrganization.url when it is not a Built In profile", () => {
    const { document, org } = page(`<a href="/company/micron-technology">Micron</a>`);
    const profile = companyProfileUrlFrom(document, org, PAGE);
    expect(companyWebsiteFrom(document, org, PAGE, profile)).toBe("https://www.micron.com/");
  });

  test("skips a builtin /company/ org.url and reads a company-box website", () => {
    const { document } = page(`
      <div class="bg-white rounded-3 p-md">
        <a href="https://north.example/about">North</a>
      </div>`);
    const org = {
      url: "https://builtin.com/company/north",
      sameAs: "https://builtin.com/company/north",
    };
    const box = document.querySelector("div.bg-white");
    expect(companyWebsiteFrom(document, org, PAGE, "https://builtin.com/company/north", box)).toBe(
      "https://north.example/about",
    );
  });

  test("does not treat a social or Built In link as the website", () => {
    const { document } = page(`
      <div class="box">
        <a href="https://linkedin.com/company/north">LinkedIn</a>
        <a href="https://builtin.com/jobs">Jobs</a>
      </div>`);
    const box = document.querySelector("div.box");
    expect(companyWebsiteFrom(document, {}, PAGE, "", box)).toBe("");
  });
});

describe("companySocialsFrom", () => {
  test("collects LinkedIn, X, Facebook, Instagram, and GitHub from the job page", () => {
    const { document } = page(`
      <a href="https://www.linkedin.com/company/micron">LinkedIn</a>
      <a href="https://x.com/micron">X</a>
      <a href="https://twitter.com/micron-old">Twitter</a>
      <a href="https://www.facebook.com/micron">Facebook</a>
      <a href="https://instagram.com/micron">Instagram</a>
      <a href="https://github.com/micron">GitHub</a>`);
    expect(companySocialsFrom(document, PAGE)).toEqual({
      linkedin: "https://www.linkedin.com/company/micron",
      x: "https://x.com/micron",
      facebook: "https://www.facebook.com/micron",
      instagram: "https://instagram.com/micron",
      github: "https://github.com/micron",
    });
  });
});

describe("companyLinkFrom", () => {
  test("prefers the website and falls back to the Built In profile URL", () => {
    expect(companyLinkFrom("https://www.micron.com/", "https://builtin.com/company/micron")).toBe(
      "https://www.micron.com/",
    );
    expect(companyLinkFrom("", "https://builtin.com/company/micron")).toBe(
      "https://builtin.com/company/micron",
    );
    expect(companyLinkFrom("", "")).toBe("");
  });
});

describe("isBuiltinCompanyUrl", () => {
  test("recognizes a Built In company profile", () => {
    expect(isBuiltinCompanyUrl("https://builtin.com/company/micron-technology")).toBe(true);
    expect(isBuiltinCompanyUrl("https://www.micron.com/")).toBe(false);
  });
});
