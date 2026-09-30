package staff

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestCaseDueMatchesStaffSLA(t *testing.T) {
	opened := time.Date(2026, 9, 25, 15, 0, 0, 0, time.UTC)
	if got := caseDue(QueueReports, opened); !got.Equal(time.Date(2026, 9, 27, 15, 0, 0, 0, time.UTC)) {
		t.Fatalf("reports sla = %s", got)
	}
	if got := caseDue(QueueFraudFlags, opened); !got.Equal(opened.Add(48 * time.Hour)) {
		t.Fatalf("fraud sla = %s", got)
	}
	if got := caseDue(QueueDisputes, opened); !got.Equal(time.Date(2026, 10, 2, 15, 0, 0, 0, time.UTC)) {
		t.Fatalf("disputes sla = %s", got)
	}
	if got := addBusinessDays(opened, 1); !got.Equal(time.Date(2026, 9, 28, 15, 0, 0, 0, time.UTC)) {
		t.Fatalf("one business day = %s", got)
	}
}

func TestReportReasonRejectsNotAGoodFit(t *testing.T) {
	err := (&ReportFiling{SubjectType: "job", SubjectID: "job-1", ReasonCode: "not_a_good_fit"}).Normalize()
	var fields *ValidationError
	if !errors.As(err, &fields) {
		t.Fatalf("err = %v", err)
	}
	if len(fields.Fields) != 1 || fields.Fields[0].Field != "reasonCode" {
		t.Fatalf("fields = %+v", fields.Fields)
	}
	err = (&CaseOpening{Queue: "retention", ReasonCode: "scam_job", SubjectType: "job", SubjectID: "job-1"}).Normalize()
	if !errors.As(err, &fields) || fields.Fields[0].Field != "queue" {
		t.Fatalf("queue fields = %+v", fields.Fields)
	}
	if err := (&CaseDecision{Decision: "settled", Reason: "money back"}).Normalize(); !errors.As(err, &fields) {
		t.Fatalf("decision err = %v", err)
	}
}

func TestMemReportsAndCases(t *testing.T) {
	ctx := context.Background()
	mem := NewMem()
	opened := time.Date(2026, 9, 25, 15, 0, 0, 0, time.UTC)
	filing := ReportFiling{
		SubjectType:  "job",
		SubjectID:    "job-1",
		ReasonCode:   "scam_job",
		Details:      "Asks for a fee",
		EvidenceKeys: []string{"shot"},
	}
	first, replayed, err := mem.FileReport(ctx, "roosebelt", "key-1", "hash-a", filing, opened)
	if err != nil || replayed {
		t.Fatalf("file = %+v replayed=%v err=%v", first, replayed, err)
	}
	if first.Report.Status != StatusOpen || first.Report.CaseID == "" || first.AuditID == "" {
		t.Fatalf("report = %+v", first)
	}
	again, replayed, err := mem.FileReport(ctx, "roosebelt", "key-1", "hash-a", filing, opened.Add(time.Minute))
	if err != nil || !replayed || again.Report.ID != first.Report.ID || again.AuditID != first.AuditID {
		t.Fatalf("replay = %+v replayed=%v err=%v", again, replayed, err)
	}
	if _, _, err := mem.FileReport(ctx, "roosebelt", "key-1", "hash-b", filing, opened); !errors.Is(err, ErrIdempotency) {
		t.Fatalf("different body = %v", err)
	}

	list, err := mem.ListCases(ctx, CaseQuery{Queue: QueueReports, Status: StatusOpen, Page: 1, PageSize: 25})
	if err != nil || list.Total != 1 || list.Next != nil {
		t.Fatalf("list = %+v err=%v", list, err)
	}
	row := list.Cases[0]
	if row.ReasonCode != "scam_job" || row.SubjectType != "job" || row.SubjectID != "job-1" || row.Queue != QueueReports {
		t.Fatalf("case = %+v", row)
	}
	if !row.SLAAt.Equal(opened.Add(48 * time.Hour)) {
		t.Fatalf("sla = %s", row.SLAAt)
	}

	appealed, err := mem.AppealReport(ctx, first.Report.ID, "roosebelt", ReportAppeal{
		Statement:    "It was a real job",
		EvidenceKeys: []string{"note"},
	}, opened.Add(24*time.Hour))
	if err != nil || appealed.Report.Status != StatusPending || appealed.Report.Appeal == nil {
		t.Fatalf("appeal = %+v err=%v", appealed, err)
	}
	pending, err := mem.ListCases(ctx, CaseQuery{Queue: QueueReports, Status: StatusPending})
	if err != nil || pending.Total != 1 || pending.Cases[0].Details != "Asks for a fee\n\nAppeal: It was a real job" {
		t.Fatalf("pending = %+v err=%v", pending, err)
	}
	if len(pending.Cases[0].EvidenceKeys) != 2 {
		t.Fatalf("evidence = %+v", pending.Cases[0].EvidenceKeys)
	}
	if _, err := mem.AppealReport(ctx, first.Report.ID, "roosebelt", ReportAppeal{Statement: "again"}, opened.Add(48*time.Hour)); err == nil || !errors.Is(err, ErrConflict) {
		t.Fatalf("second appeal = %v", err)
	}

	decided, err := mem.DecideCase(ctx, row.ID, "roosebelt", CaseDecision{
		Decision: DecisionUphold,
		Reason:   "Screenshot matches",
		Actions:  []string{"warning"},
	}, opened.Add(48*time.Hour))
	if err != nil || decided.Case.Status != StatusResolved || decided.Case.Decision != DecisionUphold || decided.Case.DecidedBy != "roosebelt" {
		t.Fatalf("decide = %+v err=%v", decided, err)
	}
	if len(decided.Case.DecisionEvidenceKeys) != 2 || len(decided.Case.Actions) != 1 {
		t.Fatalf("snapshot = %+v", decided.Case)
	}
	if _, err := mem.DecideCase(ctx, row.ID, "roosebelt", CaseDecision{Decision: DecisionDismiss, Reason: "again"}, opened); !errors.Is(err, ErrConflict) {
		t.Fatalf("second decision = %v", err)
	}
	reports, err := mem.ListReports(ctx, ReportQuery{Status: StatusResolved})
	if err != nil || reports.Total != 1 || reports.Reports[0].Resolution != DecisionUphold {
		t.Fatalf("reports = %+v err=%v", reports, err)
	}

	late := NewMem()
	filed, _, err := late.FileReport(ctx, "admin", "key-2", "hash", filing, opened)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := late.AppealReport(ctx, filed.Report.ID, "admin", ReportAppeal{Statement: "too late"}, opened.Add(appealWindow)); err == nil || !errors.Is(err, ErrConflict) {
		t.Fatalf("late appeal = %v", err)
	}

	dispute, err := mem.OpenCase(ctx, "roosebelt", CaseOpening{
		Queue:       QueueDisputes,
		ReasonCode:  "no_show",
		SubjectType: "interview",
		SubjectID:   "iv-1",
		Details:     "Candidate did not attend",
	}, opened)
	if err != nil || !dispute.Case.SLAAt.Equal(time.Date(2026, 10, 2, 15, 0, 0, 0, time.UTC)) {
		t.Fatalf("dispute = %+v err=%v", dispute, err)
	}

	audits := mem.Audits()
	if len(audits) < 4 {
		t.Fatalf("audits = %+v", audits)
	}
	for _, entry := range audits {
		if entry.Actor != "roosebelt" {
			t.Fatalf("actor = %+v", entry)
		}
	}
	if audits[0].Action != "report.file" || audits[0].SubjectType != subjectReport {
		t.Fatalf("first audit = %+v", audits[0])
	}
}
