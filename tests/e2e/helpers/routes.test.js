import { expect, test } from "bun:test";

import { jobPath } from "./routes";

test("job path encodes the fixture id", () => {
  expect(jobPath("fixture job")).toBe("/jobs/fixture%20job");
});
