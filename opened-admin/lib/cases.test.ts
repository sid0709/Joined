import { expect, test } from "bun:test";

import {
  addBusinessDays,
  caseDecisionBody,
  caseDecisionPath,
  caseDue,
  caseListQueue,
  caseListStatus,
  casePath,
  casesListQuery,
  casesPath,
  readCaseDetail,
  readCaseList,
  slaLabel,
  slaOverdue,
} from "./cases";

test("cases list path is the provisional admin queue", () => {
  expect(casesPath("reports", "open", 1, 1)).toBe(
    "/v1/admin/cases?queue=reports&status=open&page=1&pageSize=1",
  );
  expect(casesPath("disputes", "decided", 2)).toBe(
    "/v1/admin/cases?queue=disputes&status=decided&page=2&pageSize=25",
  );
  expect(casesPath("nope", "later", 1)).toBe(
    "/v1/admin/cases?queue=reports&status=open&page=1&pageSize=25",
  );
  expect(caseListQueue("disputes")).toBe("disputes");
  expect(caseListStatus(null)).toBe("open");
  expect(casesListQuery("reports", "open", 1)).toBe("");
  expect(casesListQuery("disputes", "decided", 3)).toBe("?queue=disputes&status=decided&page=3");
  expect(casePath("case/1")).toBe("/v1/admin/cases/case%2F1");
  expect(caseDecisionPath("case-1")).toBe("/v1/admin/cases/case-1/decision");
});

test("decision body requires a reason and stays on the queue's decisions", () => {
  expect(
    caseDecisionBody("reports", "uphold", " Screenshot matches ", ["warning", "warning"]),
  ).toEqual({
    decision: "uphold",
    reason: "Screenshot matches",
    actions: ["warning"],
  });
  expect(caseDecisionBody("disputes", "voided", "No attendance", [])).toEqual({
    decision: "voided",
    reason: "No attendance",
    actions: [],
  });
  expect(() => caseDecisionBody("reports", "settled", "Money back", [])).toThrow(
    "Choose a decision.",
  );
  expect(() => caseDecisionBody("disputes", "uphold", "Upheld", [])).toThrow("Choose a decision.");
  expect(() => caseDecisionBody("reports", "dismiss", "  ", [])).toThrow("Reason is required.");
  expect(() => caseDecisionBody("reports", "dismiss", "Spam", ["clawback"])).toThrow(
    "Unknown action.",
  );
});

test("SLA uses 48 hours for reports and 5 business days for disputes", () => {
  const opened = "2026-09-25T15:00:00.000Z";
  expect(caseDue("reports", opened, "")?.toISOString()).toBe("2026-09-27T15:00:00.000Z");
  expect(caseDue("disputes", opened, "")?.toISOString()).toBe("2026-10-02T15:00:00.000Z");
  expect(caseDue("reports", opened, "2026-09-26T15:00:00.000Z")?.toISOString()).toBe(
    "2026-09-26T15:00:00.000Z",
  );
  expect(caseDue("reports", "", "")).toBeNull();
  const friday = new Date("2026-09-25T15:00:00.000Z");
  expect(addBusinessDays(friday, 1).toISOString()).toBe("2026-09-28T15:00:00.000Z");
  const due = new Date("2026-09-27T15:00:00.000Z");
  const now = new Date("2026-09-28T15:00:00.000Z");
  expect(slaOverdue(due, now)).toBe(true);
  expect(slaLabel(due, now)).toBe("overdue 1d");
  expect(slaLabel(due, new Date("2026-09-27T03:00:00.000Z"))).toBe("due 12h");
  expect(slaLabel(null)).toBe("—");
});

test("case list and detail parse camelCase and docs snake_case", () => {
  const list = readCaseList({
    cases: [
      {
        id: "case-1",
        queue: "reports",
        status: "open",
        reason_code: "scam_job",
        subject_type: "job",
        subject_id: "job-1",
        subject: { name: "Engineer" },
        reporter_user_id: "user-1",
        created_at: "2026-09-01T00:00:00Z",
        sla_at: "2026-09-03T00:00:00Z",
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
    subjectLabel: "Engineer",
    reporterId: "user-1",
    slaAt: "2026-09-03T00:00:00Z",
  });

  expect(readCaseList({ data: [] })).toEqual({ rows: [], total: 0, recognized: true });
  expect(readCaseList({ jobs: [] }).recognized).toBe(false);
  expect(readCaseList({ cases: [{ queue: "reports" }] }).recognized).toBe(false);

  const detail = readCaseDetail({
    case: {
      id: "case-2",
      queue: "disputes",
      status: "open",
      reasonCode: "no_show",
      subjectType: "interview",
      subjectId: "int-1",
      subjectLabel: "Monday screen",
      details: "Candidate did not join.",
      evidence: [
        "shot-1",
        { id: "ev-2", label: "Calendar", url: "https://example.test/c", note: "Hold" },
      ],
      linked_accounts: [{ type: "user", id: "user-9", name: "Ada" }],
      history: [{ at: "2026-09-01T00:00:00Z", actor: "ada", action: "filed", note: "Opened" }],
    },
  });
  expect(detail?.details).toBe("Candidate did not join.");
  expect(detail?.evidence).toEqual([
    { id: "shot-1", label: "shot-1", url: "", note: "" },
    { id: "ev-2", label: "Calendar", url: "https://example.test/c", note: "Hold" },
  ]);
  expect(detail?.subjects).toEqual([{ type: "user", id: "user-9", label: "Ada" }]);
  expect(detail?.history[0]?.reason).toBe("Opened");
  expect(readCaseDetail({ id: "" })).toBeNull();
  expect(readCaseDetail(null)).toBeNull();
});
