import { expect, test } from "bun:test";

import {
  DEFAULT_REJECT_DISPOSITION,
  directJobsPath,
  jobReviewBody,
  jobTakedownBody,
  readCompanyVerification,
  readDirectJobList,
  readPendingCount,
  readReviewedJob,
  readVerificationList,
  requireReason,
  trustLoadError,
  verificationListStatus,
  verificationsPath,
  verifyCompanyBody,
} from "./trust";

test("verification list uses camelCase pageSize and never the cases queue", () => {
  expect(verificationsPath("pending", 1, 1)).toBe(
    "/v1/admin/companies/verifications?status=pending&page=1&pageSize=1",
  );
  expect(verificationsPath("nope", 2)).toBe(
    "/v1/admin/companies/verifications?status=pending&page=2&pageSize=25",
  );
  expect(verificationsPath("suspended", 1)).toContain("status=suspended");
  expect(verificationsPath("pending", 1)).not.toContain("/cases");
  expect(verificationListStatus(null)).toBe("pending");
});

test("direct jobs list is source direct and pending_review", () => {
  expect(directJobsPath(1)).toBe(
    "/v1/admin/jobs?source=direct&status=pending_review&page=1&pageSize=25",
  );
});

test("decision bodies match the locked contract", () => {
  expect(() => requireReason("  ")).toThrow("Reason is required.");
  expect(verifyCompanyBody("suspend", " Domain mismatch ")).toEqual({
    decision: "suspend",
    reason: "Domain mismatch",
  });
  expect(jobReviewBody("approve", "Domain matches")).toEqual({
    decision: "approve",
    reason: "Domain matches",
  });
  expect(jobReviewBody("approve", "  ")).toEqual({ decision: "approve" });
  expect(jobReviewBody("reject", "Scam copy", "draft")).toEqual({
    decision: "reject",
    reason: "Scam copy",
    rejectDisposition: "draft",
  });
  expect(DEFAULT_REJECT_DISPOSITION).toBe("removed");
  expect(jobReviewBody("reject", "", DEFAULT_REJECT_DISPOSITION)).toEqual({
    decision: "reject",
    rejectDisposition: "removed",
  });
  expect(() => jobReviewBody("reject", "Scam copy")).toThrow("Choose removed or draft.");
  expect(jobTakedownBody("Off-platform fee")).toEqual({ reason: "Off-platform fee" });
  expect(() => jobTakedownBody(" ")).toThrow("Reason is required.");
});

test("verification list and company detail read camelCase only", () => {
  const list = readVerificationList({
    data: [
      {
        id: "claim-1",
        companyId: "co-1",
        companyName: "Acme",
        claimMethod: "dns_txt",
        requestedBy: "a@acme.test",
        domains: ["acme.test"],
        memberCount: 2,
        status: "pending",
        createdAt: "2026-09-01T00:00:00Z",
        slaAt: "2026-09-03T00:00:00Z",
      },
    ],
    total: 4,
    next: "2",
  });
  expect(list.recognized).toBe(true);
  expect(list.total).toBe(4);
  expect(list.rows[0]).toMatchObject({ companyId: "co-1", memberCount: 2, domains: ["acme.test"] });
  expect(readVerificationList({ cases: [] }).recognized).toBe(false);
  expect(readVerificationList({ data: [] })).toEqual({ rows: [], total: 0, recognized: true });
  expect(readPendingCount({ pending: 3 })).toBe(3);
  expect(readPendingCount({ total: 3 })).toBeNull();

  const detail = readCompanyVerification({
    id: "co-1",
    name: "Acme",
    url: "https://acme.test",
    primaryDomain: "acme.test",
    domains: [{ domain: "acme.test", verified: true }],
    members: [
      { userId: "u1", email: "a@acme.test", role: "owner", createdAt: "2026-09-01T00:00:00Z" },
    ],
    claimMethod: "domain_email",
    claimed: true,
    verificationStatus: "pending",
    pendingClaim: {
      id: "claim-1",
      method: "domain_email",
      requestedBy: "a@acme.test",
      createdAt: "2026-09-01T00:00:00Z",
    },
    audit: [{ at: "2026-09-01T00:00:00Z", actor: "admin", action: "reject", reason: "Mismatch" }],
  });
  expect(detail?.name).toBe("Acme");
  expect(detail?.url).toBe("https://acme.test");
  expect(detail?.domains[0]?.verified).toBe(true);
  expect(detail?.members[0]?.userId).toBe("u1");
  expect(detail?.members[0]?.name).toBe("");
  expect(detail?.pendingClaim?.method).toBe("domain_email");
  expect(detail?.audit[0]?.reason).toBe("Mismatch");

  const staff = readCompanyVerification({
    id: "co_123",
    companyName: "Northwind",
    name: "Legacy",
    companyUrl: "https://northwind.example",
    url: "https://legacy.example",
    domains: ["northwind.example", "  ", { domain: "jobs.northwind.example", verified: true }],
    members: [
      {
        userId: "user_123",
        name: "Ada Lovelace",
        email: "ada@northwind.example",
        role: "owner",
        hiringRole: "owner",
      },
    ],
    claimMethod: "manual",
    claimed: true,
    verificationStatus: "pending",
    pendingClaim: {
      id: "674c1f0e5b2a4e18d0a1c001",
      claimMethod: "manual",
      method: "dns_txt",
      requestedBy: "user_123",
      domains: ["northwind.example"],
      status: "pending",
      createdAt: "2026-09-29T17:00:00Z",
      slaAt: "2026-10-01T17:00:00Z",
    },
    verifiedAt: "2026-09-29T18:00:00Z",
    suspendedAt: "2026-09-29T19:00:00Z",
    audit: [
      {
        action: "company.verify.approve",
        subjectType: "company",
        subjectId: "co_123",
        actor: "roosebelt",
        note: "Work email is on the company domain",
        reason: "Legacy reason",
        at: "2026-09-29T18:00:00Z",
      },
    ],
  });
  expect(staff?.name).toBe("Northwind");
  expect(staff?.url).toBe("https://northwind.example");
  expect(staff?.domains).toEqual([
    { domain: "northwind.example", verified: false },
    { domain: "jobs.northwind.example", verified: true },
  ]);
  expect(staff?.members[0]).toEqual({
    userId: "user_123",
    name: "Ada Lovelace",
    email: "ada@northwind.example",
    role: "owner",
    createdAt: "",
  });
  expect(staff?.claimMethod).toBe("manual");
  expect(staff?.pendingClaim?.method).toBe("manual");
  expect(staff?.audit[0]).toEqual({
    at: "2026-09-29T18:00:00Z",
    actor: "roosebelt",
    action: "company.verify.approve",
    reason: "Work email is on the company domain",
  });
});

test("direct job list reads jobs and review answers unwrap job", () => {
  const list = readDirectJobList({
    jobs: [
      {
        id: "job-1",
        title: "Engineer",
        companyId: "co-1",
        companyName: "Acme",
        source: "direct",
        status: "pending_review",
        createdAt: "2026-09-01T00:00:00Z",
        location: "Remote",
      },
    ],
    total: 1,
  });
  expect(list.rows[0]).toMatchObject({
    companyId: "co-1",
    location: "Remote",
    status: "pending_review",
  });
  expect(readDirectJobList({ data: [] }).recognized).toBe(false);
  expect(
    readReviewedJob({
      auditId: "aud-1",
      job: {
        id: "job-1",
        companyId: "co-1",
        companyName: "Acme",
        source: "direct",
        status: "removed",
      },
    })?.status,
  ).toBe("removed");
});

test("missing endpoints get a distinct message", () => {
  expect(trustLoadError(404, "not found")).toContain("not on the API yet");
  expect(trustLoadError(500, "upstream")).toBe("upstream");
});
