import { describe, expect, test } from "bun:test";

import { canApplyToJob, jobApplyLink } from "./apply";

describe("job apply link", () => {
  test("trims the link and treats blank as none", () => {
    expect(jobApplyLink({ applyLink: " https://a.test/apply " })).toBe("https://a.test/apply");
    expect(jobApplyLink({ applyLink: "   " })).toBeNull();
    expect(jobApplyLink({})).toBeNull();
  });

  test("can apply with a link or a direct job, otherwise not", () => {
    expect(canApplyToJob({ applyLink: "https://a.test", source: "scouted" })).toBe(true);
    expect(canApplyToJob({ source: "direct" })).toBe(true);
    expect(canApplyToJob({ source: "scouted" })).toBe(false);
  });
});
