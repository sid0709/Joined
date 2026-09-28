import { expect, test } from "bun:test";

import { activeHref, ROUTES } from "./nav";

test("the deepest matching link is active", () => {
  expect(activeHref("/scouting")).toBe(ROUTES.scouting);
  expect(activeHref("/scouting/queue")).toBe(ROUTES.queue);
  expect(activeHref("/jobs/temp")).toBe(ROUTES.tempJobs);
  expect(activeHref("/jobs/scout")).toBe(ROUTES.scoutJobs);
  expect(activeHref("/jobs")).toBe(ROUTES.jobs);
  expect(activeHref("/elsewhere")).toBeUndefined();
});

test("routes build ids into paths", () => {
  expect(ROUTES.submission("abc")).toBe("/scouting/submissions/abc");
  expect(ROUTES.scout("u1")).toBe("/scouting/scouts/u1");
});
