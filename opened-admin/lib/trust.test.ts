import { expect, test } from "bun:test";

import {
  caseDecisionBody,
  caseStatus,
  companyCasesPath,
  directJobStatus,
  directJobsPath,
  jobReviewBody,
  jobTakedownBody,
  readCaseDetail,
  readCaseList,
  readDirectJobDetail,
  readDirectJobList,
  requireReason,
  trustLoadError,
} from "./trust";

test("company cases path pins the verification queue", () => {
  expect(companyCasesPath("pending", 1, 1)).toBe(
    "/v1/admin/cases?queue=company_verification&page=1&page_size=1&status=pending",
  );
  expect(companyCasesPath("", 2)).toBe(
    "/v1/admin/cases?queue=company_verification&page=2&page_size=25",
  );
  expect(caseStatus(null)).toBe("pending");
  expect(caseStatus("all")).toBe("");
});

test("direct jobs path asks for source and status", () => {
  expect(directJobsPath("pending_review", 1)).toBe(
    "/v1/admin/jobs?source=direct&page=1&page_size=25&status=pending_review",
  );
  expect(directJobStatus("nope")).toBe("pending_review");
  expect(directJobStatus("removed")).toBe("removed");
});

test("decisions require a reason and an explicit job disposition", () => {
  expect(() => requireReason("  ")).toThrow("Reason is required.");
  expect(caseDecisionBody("suspend", " Domain mismatch ")).toEqual({
    decision: "suspend",
    reason: "Domain mismatch",
    actions: [],
  });
  expect(jobReviewBody("approve", "Domain matches")).toEqual({
    decision: "approve",
    disposition: "active",
    reason: "Domain matches",
  });
  expect(jobReviewBody("reject", "Scam copy", "draft")).toEqual({
    decision: "reject",
    disposition: "draft",
    reason: "Scam copy",
  });
  expect(() => jobReviewBody("reject", "Scam copy")).toThrow("Choose removed or draft.");
  expect(jobTakedownBody("takedown", "Off-platform fee")).toEqual({
    decision: "takedown",
    disposition: "removed",
    reason: "Off-platform fee",
  });
  expect(jobTakedownBody("restore", "Restored after appeal")).toEqual({
    decision: "restore",
    disposition: "active",
    reason: "Restored after appeal",
  });
});

test("case lists accept the docs envelope and a cases alias", () => {
  const item = {
    id: "case-1",
    status: "pending",
    domain: "acme.test",
    claim_method: "dns_txt",
    company: { id: "co-1", name: "Acme", primary_domain: "acme.test", status: "unclaimed" },
    members: [{ user_id: "u1", email: "a@acme.test", role: "owner", status: "active" }],
    created_at: "2026-09-01T00:00:00Z",
  };
  const fromData = readCaseList({ data: [item], total: 4 });
  expect(fromData.recognized).toBe(true);
  expect(fromData.total).toBe(4);
  expect(fromData.rows[0]?.company?.id).toBe("co-1");
  expect(fromData.rows[0]?.members[0]?.email).toBe("a@acme.test");
  expect(readCaseList({ cases: [] })).toEqual({ rows: [], total: 0, recognized: true });
  expect(readCaseList({ ok: true }).recognized).toBe(false);
  expect(readCaseDetail({ case: item })?.claimMethod).toBe("dns_txt");
});

test("direct job lists accept admin rows and nested search jobs", () => {
  const admin = readDirectJobList({
    data: [
      {
        id: "job-1",
        title: "Engineer",
        company_id: "co-1",
        company_name: "Acme",
        source: "direct",
        status: "pending_review",
      },
    ],
    total: 1,
  });
  expect(admin.rows[0]).toMatchObject({
    id: "job-1",
    companyId: "co-1",
    status: "pending_review",
  });
  const nested = readDirectJobDetail({
    job: { id: "job-2", title: "Designer", company: "Acme", companyId: "co-2", source: "direct" },
    status: "active",
    applyLink: "https://acme.test/apply",
  });
  expect(nested).toMatchObject({
    id: "job-2",
    companyName: "Acme",
    status: "active",
    applyUrl: "https://acme.test/apply",
  });
});

test("missing endpoints get a distinct message", () => {
  expect(trustLoadError(404, "not found")).toContain("not on the API yet");
  expect(trustLoadError(500, "upstream")).toBe("upstream");
});
