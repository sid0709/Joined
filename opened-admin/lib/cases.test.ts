import { expect, test } from "bun:test";

import {
  MY_REPORTS_PATH,
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
  fileReportBody,
  isCompanyAtsReason,
  readCaseList,
  reportAppealPath,
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
  expect(reportAppealPath("rep/1")).toBe("/v1/reports/rep%2F1/appeal");
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

test("case list reads the assumed camelCase cases envelope", () => {
  const list = readCaseList({
    cases: [
      {
        id: "case-1",
        queue: "reports",
        status: "open",
        reasonCode: "scam_job",
        subjectType: "job",
        subjectId: "job-1",
        details: "Fee requested",
        evidenceKeys: ["shot-1", " "],
        createdAt: "2026-09-01T00:00:00Z",
        slaAt: "2026-09-03T00:00:00Z",
      },
    ],
    total: 2,
  });
  expect(list.recognized).toBe(true);
  expect(list.total).toBe(2);
  expect(list.rows[0]).toMatchObject({
    reasonCode: "scam_job",
    subjectType: "job",
    subjectId: "job-1",
    details: "Fee requested",
    evidenceKeys: ["shot-1"],
    slaAt: "2026-09-03T00:00:00Z",
  });
  expect(readCaseList({ cases: [] })).toEqual({ rows: [], total: 0, recognized: true });
  expect(readCaseList({ data: [] }).recognized).toBe(false);
  expect(readCaseList({ cases: [{ queue: "reports" }] }).recognized).toBe(false);
  const snake = readCaseList({
    cases: [{ id: "case-2", reason_code: "scam_job", subject_type: "job" }],
  });
  expect(snake.rows[0]).toMatchObject({ reasonCode: "", subjectType: "" });

  const row = list.rows[0];
  if (!row) throw new Error("missing row");
  const params = new URLSearchParams(caseRecordQuery(row));
  expect(caseFromSearch(row.id, params)).toEqual(row);
});
