import { expect, test } from "bun:test";

import { activeHref, ROUTES, signInHref } from "./nav";

test("the deepest matching link is active", () => {
  expect(activeHref("/scouting")).toBe(ROUTES.scouting);
  expect(activeHref("/scouting/queue")).toBe(ROUTES.queue);
  expect(activeHref("/temp/jobs")).toBe(ROUTES.tempJobs);
  expect(activeHref("/temp/companies")).toBe(ROUTES.tempCompanies);
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
  expect(activeHref("/users")).toBe(ROUTES.users);
  expect(activeHref("/users/user-1")).toBe(ROUTES.users);
  expect(activeHref("/monitoring")).toBe(ROUTES.monitoring);
  expect(activeHref("/monitoring/host")).toBe(ROUTES.monitoringHost);
  expect(activeHref("/monitoring/traffic")).toBe(ROUTES.monitoringTraffic);
  expect(activeHref("/monitoring/data")).toBe(ROUTES.monitoringData);
  expect(activeHref("/monitoring/product")).toBe(ROUTES.monitoringProduct);
  expect(activeHref("/monitoring/incidents")).toBe(ROUTES.statusIncidents);
  expect(activeHref("/monitoring/system")).toBe(ROUTES.monitoring);
  expect(activeHref("/settings/ai-model")).toBe(ROUTES.aiModel);
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
  expect(ROUTES.user("user-1")).toBe("/users/user-1");
});

test("sign-in keeps the way back", () => {
  expect(signInHref("/trust/cases?q=a b")).toBe("/sign-in?next=%2Ftrust%2Fcases%3Fq%3Da%20b");
  expect(signInHref(null)).toBe("/sign-in");
});
