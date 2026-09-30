import { expect, test } from "bun:test";

import { activeHref, ROUTES } from "./nav";

test("the deepest matching link is active", () => {
  expect(activeHref("/scouting")).toBe(ROUTES.scouting);
  expect(activeHref("/scouting/queue")).toBe(ROUTES.queue);
  expect(activeHref("/jobs/temp")).toBe(ROUTES.tempJobs);
  expect(activeHref("/jobs/scout")).toBe(ROUTES.scoutJobs);
  expect(activeHref("/jobs")).toBe(ROUTES.jobs);
  expect(activeHref("/jobs/direct-review")).toBe(ROUTES.directReview);
  expect(activeHref("/jobs/direct-review/job-1")).toBe(ROUTES.directReview);
  expect(activeHref("/trust/company-verification")).toBe(ROUTES.companyVerification);
  expect(activeHref("/trust/company-verification/case-1")).toBe(ROUTES.companyVerification);
  expect(activeHref("/trust/cases")).toBe(ROUTES.cases);
  expect(activeHref("/trust/cases/case-1")).toBe(ROUTES.cases);
  expect(activeHref("/trust/cases/new")).toBe(ROUTES.createCase);
  expect(activeHref("/trust/reports")).toBe(ROUTES.reports);
  expect(activeHref("/trust/reports/new")).toBe(ROUTES.reports);
  expect(activeHref("/trust/reports/rep-1")).toBe(ROUTES.reports);
  expect(activeHref("/ops")).toBe(ROUTES.retentionOps);
  expect(activeHref("/elsewhere")).toBeUndefined();
});

test("routes build ids into paths", () => {
  expect(ROUTES.submission("abc")).toBe("/scouting/submissions/abc");
  expect(ROUTES.scout("u1")).toBe("/scouting/scouts/u1");
  expect(ROUTES.companyCase("case-1")).toBe("/trust/company-verification/case-1");
  expect(ROUTES.directJob("job-1")).toBe("/jobs/direct-review/job-1");
  expect(ROUTES.moderationCase("case-1")).toBe("/trust/cases/case-1");
  expect(ROUTES.report("rep-1")).toBe("/trust/reports/rep-1");
  expect(ROUTES.createCase).toBe("/trust/cases/new");
  expect(ROUTES.fileReport).toBe("/trust/reports/new");
});
