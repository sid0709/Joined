import { describe, expect, test } from "bun:test";

import { detectJobBoard, firstPathSegment, hostnameMatches, workdayCompanyFromHost } from "./hosts";

describe("detectJobBoard", () => {
  test("detects hosted greenhouse, lever, ashby, workday, and linkedin job urls", () => {
    expect(detectJobBoard("https://boards.greenhouse.io/acme/jobs/123")).toBe("greenhouse");
    expect(detectJobBoard("https://job-boards.greenhouse.io/acme/jobs/123")).toBe("greenhouse");
    expect(detectJobBoard("https://jobs.lever.co/acme/abc-def")).toBe("lever");
    expect(detectJobBoard("https://jobs.ashbyhq.com/acme/abc-def")).toBe("ashby");
    expect(
      detectJobBoard("https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/SF/Title_JR1"),
    ).toBe("workday");
    expect(detectJobBoard("https://www.linkedin.com/jobs/view/123")).toBe("linkedin");
    expect(
      detectJobBoard("https://linkedin.com/jobs/collections/recommended/?currentJobId=9"),
    ).toBe("linkedin");
  });

  test("returns unknown for invalid urls and non-job linkedin pages", () => {
    expect(detectJobBoard("not-a-url")).toBe("unknown");
    expect(detectJobBoard("https://www.linkedin.com/feed/")).toBe("unknown");
    expect(detectJobBoard("https://careers.acme.test/jobs/123")).toBe("unknown");
  });

  test("does not treat lookalike hosts as greenhouse", () => {
    expect(detectJobBoard("https://evilgreenhouse.io/acme/jobs/1")).toBe("unknown");
  });
});

describe("hostname helpers", () => {
  test("hostnameMatches requires an exact host or a dotted suffix", () => {
    expect(hostnameMatches("jobs.lever.co", ["jobs.lever.co"])).toBe(true);
    expect(hostnameMatches("www.linkedin.com", ["linkedin.com"])).toBe(true);
    expect(hostnameMatches("notlinkedin.com", ["linkedin.com"])).toBe(false);
  });

  test("firstPathSegment and workdayCompanyFromHost read board tokens", () => {
    expect(firstPathSegment("/acme/jobs/123")).toBe("acme");
    expect(firstPathSegment("/")).toBe("");
    expect(workdayCompanyFromHost("acme.wd5.myworkdayjobs.com")).toBe("acme");
    expect(workdayCompanyFromHost("example.com")).toBe("");
  });
});
