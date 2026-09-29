import { expect, test } from "bun:test";

import {
  MY_REPORTS_PATH,
  REPORT_IDEMPOTENCY_HEADER,
  addBusinessDays,
  appealReportBody,
  caseDecisionBody,
  caseDecisionPath,
  caseDue,
  caseFromSearch,
  caseListQueue,
  caseListStatus,
  caseRecordQuery,
  casesListQuery,
  casesPath,
  createCaseBody,
  fileReportBody,
  isCompanyAtsReason,
  readCaseList,
  readCasePayload,
  readReportList,
  reportAppealPath,
  reportsPath,
  slaLabel,
} from "./cases";

test("staff list path uses the locked queues and statuses", () => {
  expect(casesPath("reports", "open", 1, 1)).toBe(
    "/v1/admin/cases?queue=reports&status=open&page=1&pageSize=1",
  );
  expect(casesPath("disputes", "pending", 2)).toBe(
    "/v1/admin/cases?queue=disputes&status=pending&page=2&pageSize=25",
  );
  expect(casesPath("fraud_flags", "resolved", 1)).toContain("queue=fraud_flags");
  expect(casesPath("fraud_flags", "resolved", 1)).toContain("status=resolved");
  expect(casesPath("nope", "", 1)).toContain("queue=reports");
  expect(casesPath("reports", "escalated", 1)).toContain("status=escalated");
  expect(caseListQueue("fraud_flags")).toBe("fraud_flags");
  expect(caseListStatus(null)).toBe("open");
  expect(caseListStatus("  pending ")).toBe("pending");
  expect(casesListQuery("reports", "open", 1)).toBe("");
  expect(casesListQuery("fraud_flags", "resolved", 3)).toBe(
    "?queue=fraud_flags&status=resolved&page=3",
  );
  expect(caseDecisionPath("case/1")).toBe("/v1/admin/cases/case%2F1/decision");
});

test("public report and appeal bodies stay on the locked camelCase shape", () => {
  expect(MY_REPORTS_PATH).toBe("/v1/me/reports");
  expect(REPORT_IDEMPOTENCY_HEADER).toBe("Idempotency-Key");
  expect(reportAppealPath("rep/1")).toBe("/v1/reports/rep%2F1/appeal");
  expect(reportsPath("open", 1, 10)).toBe("/v1/reports?page=1&pageSize=10&status=open");
  expect(reportsPath("", 2)).toBe("/v1/reports?page=2&pageSize=25");
  expect(
    fileReportBody({
      subjectType: " job ",
      subjectId: " job-1 ",
      reasonCode: "scam_job",
      details: " Asks for a fee ",
      evidenceKeys: [" shot ", "", "shot"],
    }),
  ).toEqual({
    subjectType: "job",
    subjectId: "job-1",
    reasonCode: "scam_job",
    details: "Asks for a fee",
    evidenceKeys: ["shot"],
  });
  expect(() =>
    fileReportBody({
      subjectType: "job",
      subjectId: "job-1",
      reasonCode: "not_a_good_fit",
      details: "",
      evidenceKeys: [],
    }),
  ).toThrow("Unknown reason code.");
  expect(() =>
    fileReportBody({
      subjectType: " ",
      subjectId: "job-1",
      reasonCode: "fake_company",
      details: "",
      evidenceKeys: [],
    }),
  ).toThrow("Subject is required.");
  expect(appealReportBody(" They hid the interview ", ["note"])).toEqual({
    statement: "They hid the interview",
    evidenceKeys: ["note"],
  });
  expect(isCompanyAtsReason("identity_mismatch")).toBe(true);
  expect(isCompanyAtsReason("no_show")).toBe(false);
});

test("create case body matches POST /v1/admin/cases", () => {
  expect(
    createCaseBody({
      queue: "disputes",
      reasonCode: "no_show",
      subjectType: " interview ",
      subjectId: " iv_1 ",
      details: " Candidate did not attend ",
      evidenceKeys: [],
    }),
  ).toEqual({
    queue: "disputes",
    reasonCode: "no_show",
    subjectType: "interview",
    subjectId: "iv_1",
    details: "Candidate did not attend",
  });
  expect(
    createCaseBody({
      queue: "reports",
      reasonCode: "scam_job",
      subjectType: "job",
      subjectId: "job_1",
      evidenceKeys: ["shot"],
    }),
  ).toEqual({
    queue: "reports",
    reasonCode: "scam_job",
    subjectType: "job",
    subjectId: "job_1",
    evidenceKeys: ["shot"],
  });
  expect(() =>
    createCaseBody({
      queue: "settlements",
      reasonCode: "no_show",
      subjectType: "interview",
      subjectId: "iv_1",
    }),
  ).toThrow("Choose a queue.");
  expect(() =>
    createCaseBody({
      queue: "reports",
      reasonCode: "not_a_good_fit",
      subjectType: "job",
      subjectId: "job_1",
    }),
  ).toThrow("Unknown reason code.");
});

test("decision body is uphold or dismiss and omits empty actions", () => {
  expect(caseDecisionBody("uphold", " Screenshot matches ")).toEqual({
    decision: "uphold",
    reason: "Screenshot matches",
  });
  expect(caseDecisionBody("dismiss", "Duplicate", ["warning", " warning "])).toEqual({
    decision: "dismiss",
    reason: "Duplicate",
    actions: ["warning"],
  });
  expect(() => caseDecisionBody("settled", "Money back")).toThrow("Choose a decision.");
  expect(() => caseDecisionBody("voided", "No show")).toThrow("Choose a decision.");
  expect(() => caseDecisionBody("uphold", "  ")).toThrow("Reason is required.");
});

test("SLA uses 48 hours except disputes, which use 5 business days", () => {
  const opened = "2026-09-25T15:00:00.000Z";
  expect(caseDue("reports", opened, "")?.toISOString()).toBe("2026-09-27T15:00:00.000Z");
  expect(caseDue("fraud_flags", opened, "")?.toISOString()).toBe("2026-09-27T15:00:00.000Z");
  expect(caseDue("disputes", opened, "")?.toISOString()).toBe("2026-10-02T15:00:00.000Z");
  expect(caseDue("reports", opened, "2026-09-26T15:00:00.000Z")?.toISOString()).toBe(
    "2026-09-26T15:00:00.000Z",
  );
  expect(addBusinessDays(new Date(opened), 1).toISOString()).toBe("2026-09-28T15:00:00.000Z");
  expect(slaLabel(null)).toBe("—");
});

test("case list reads Einstein Layer H fixtures including empty decision", () => {
  expect(readCaseList({ cases: [], total: 0 })).toEqual({
    rows: [],
    total: 0,
    recognized: true,
  });

  const openList = readCaseList({
    cases: [
      {
        id: "674c1f0e5b2a4e18d0a1c010",
        queue: "disputes",
        status: "open",
        reasonCode: "no_show",
        subjectType: "interview",
        subjectId: "iv_1",
        details: "Candidate did not attend",
        evidenceKeys: [],
        createdAt: "2026-09-29T17:00:00Z",
        slaAt: "2026-10-06T17:00:00Z",
        decision: "",
      },
    ],
    total: 1,
  });
  expect(openList.recognized).toBe(true);
  expect(openList.total).toBe(1);
  expect(openList.rows[0]).toEqual({
    id: "674c1f0e5b2a4e18d0a1c010",
    queue: "disputes",
    status: "open",
    reasonCode: "no_show",
    subjectType: "interview",
    subjectId: "iv_1",
    details: "Candidate did not attend",
    evidenceKeys: [],
    createdAt: "2026-09-29T17:00:00Z",
    slaAt: "2026-10-06T17:00:00Z",
    decision: "",
    decidedBy: "",
    decisionReason: "",
    decisionEvidenceKeys: [],
  });

  const createPayload = readCasePayload({
    case: openList.rows[0],
    auditId: "674c1f0e5b2a4e18d0a1c0aa",
  });
  expect(createPayload?.id).toBe("674c1f0e5b2a4e18d0a1c010");
  expect(createPayload?.decision).toBe("");

  const decided = readCasePayload({
    case: {
      id: "674c1f0e5b2a4e18d0a1c010",
      queue: "disputes",
      status: "resolved",
      reasonCode: "no_show",
      subjectType: "interview",
      subjectId: "iv_1",
      details: "Candidate did not attend",
      evidenceKeys: ["shot"],
      createdAt: "2026-09-29T17:00:00Z",
      slaAt: "2026-10-06T17:00:00Z",
      decision: "uphold",
      decidedBy: "admin",
      decisionReason: "Screenshot matches",
      decisionEvidenceKeys: ["shot"],
    },
    auditId: "audit-1",
  });
  expect(decided).toMatchObject({
    status: "resolved",
    decision: "uphold",
    decidedBy: "admin",
    decisionReason: "Screenshot matches",
    decisionEvidenceKeys: ["shot"],
  });

  expect(readCaseList({ data: [] }).recognized).toBe(false);
  expect(readCaseList({ cases: [{ queue: "reports" }] }).recognized).toBe(false);
  const snake = readCaseList({
    cases: [{ id: "case-2", reason_code: "scam_job", subject_type: "job", evidenceKeys: [] }],
  });
  expect(snake.rows[0]).toMatchObject({ reasonCode: "", subjectType: "", decision: "" });

  const row = openList.rows[0];
  if (!row) throw new Error("missing row");
  const params = new URLSearchParams(caseRecordQuery(row));
  expect(caseFromSearch(row.id, params)).toEqual(row);

  const decidedRow = decided;
  if (!decidedRow) throw new Error("missing decided");
  const decidedParams = new URLSearchParams(caseRecordQuery(decidedRow));
  expect(caseFromSearch(decidedRow.id, decidedParams)).toEqual(decidedRow);
});

test("staff report list reads GET /v1/reports envelope", () => {
  expect(readReportList({ reports: [], total: 0 })).toEqual({
    rows: [],
    total: 0,
    recognized: true,
  });
  const list = readReportList({
    reports: [
      {
        id: "674c1f0e5b2a4e18d0a1c020",
        subjectType: "job",
        subjectId: "job_1",
        reasonCode: "scam_job",
        details: "Asks for a fee",
        evidenceKeys: ["shot"],
        status: "open",
        caseId: "674c1f0e5b2a4e18d0a1c010",
        createdAt: "2026-09-29T17:00:00Z",
      },
    ],
    total: 1,
  });
  expect(list.recognized).toBe(true);
  expect(list.rows[0]).toMatchObject({
    id: "674c1f0e5b2a4e18d0a1c020",
    caseId: "674c1f0e5b2a4e18d0a1c010",
    evidenceKeys: ["shot"],
    status: "open",
    resolution: "",
  });
  expect(readReportList({ data: [] }).recognized).toBe(false);
});
