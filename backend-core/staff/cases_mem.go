package staff

import (
	"context"
	"sort"
	"strings"
	"sync"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// Mem is an in-memory staff API for tests. Company and job methods are unused.
// cmd/server wires Store, not Mem.
type Mem struct {
	mu      sync.Mutex
	cases   map[string]storedCase
	reports map[string]storedReport
	claims  map[string]reportClaim
	audits  []storedAudit
}

// NewMem returns an empty staff API.
func NewMem() *Mem {
	return &Mem{
		cases:   map[string]storedCase{},
		reports: map[string]storedReport{},
		claims:  map[string]reportClaim{},
	}
}

// WriteAudit records one admin_audit row and returns its id.
func (m *Mem) WriteAudit(_ context.Context, action, subjectType, subjectID, actor, note string, now time.Time) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	doc := storedAudit{
		ID:          bson.NewObjectID(),
		Action:      action,
		SubjectType: subjectType,
		SubjectID:   subjectID,
		Actor:       actor,
		Note:        note,
		At:          now.UTC(),
	}
	m.audits = append(m.audits, doc)
	return doc.ID.Hex(), nil
}

// AuditsFor returns audit rows for one subject, newest first.
func (m *Mem) AuditsFor(_ context.Context, subjectID string) ([]AuditEntry, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []AuditEntry
	for i := len(m.audits) - 1; i >= 0; i-- {
		doc := m.audits[i]
		if doc.SubjectID != subjectID {
			continue
		}
		out = append(out, AuditEntry{
			Action: doc.Action, SubjectType: doc.SubjectType, SubjectID: doc.SubjectID,
			Actor: doc.Actor, Note: doc.Note, At: doc.At,
		})
	}
	return out, nil
}

// Audits returns recorded admin_audit rows in insertion order.
func (m *Mem) Audits() []AuditEntry {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]AuditEntry, len(m.audits))
	for i, doc := range m.audits {
		out[i] = AuditEntry{
			Action:      doc.Action,
			SubjectType: doc.SubjectType,
			SubjectID:   doc.SubjectID,
			Actor:       doc.Actor,
			Note:        doc.Note,
			At:          doc.At,
		}
	}
	return out
}

func (m *Mem) ListVerifications(context.Context, VerificationQuery) (VerificationList, error) {
	return VerificationList{Data: []Verification{}}, nil
}

func (m *Mem) PendingVerifications(context.Context) (PendingCount, error) {
	return PendingCount{}, nil
}

func (m *Mem) Company(context.Context, string) (CompanyDetail, error) {
	return CompanyDetail{}, ErrNotFound
}

func (m *Mem) VerifyCompany(context.Context, string, string, CompanyVerify, time.Time) (VerifyResult, error) {
	return VerifyResult{}, ErrNotFound
}

func (m *Mem) NoteCompanyCreated(context.Context, string, string, string, time.Time) error {
	return nil
}

func (m *Mem) ListDirectJobs(context.Context, JobQuery) (JobList, error) {
	return JobList{Jobs: []DirectJob{}}, nil
}

func (m *Mem) ReviewDirectJob(context.Context, string, string, JobReview, time.Time) (JobResult, error) {
	return JobResult{}, ErrNotFound
}

func (m *Mem) TakedownDirectJob(context.Context, string, string, string, time.Time) (JobResult, error) {
	return JobResult{}, ErrNotFound
}

// ListCases returns the moderation queue. Empty queue or status means every value.
func (m *Mem) ListCases(_ context.Context, query CaseQuery) (CaseList, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	queue := strings.TrimSpace(query.Queue)
	status := strings.TrimSpace(query.Status)
	rows := make([]storedCase, 0, len(m.cases))
	for _, cas := range m.cases {
		if queue != "" && cas.Queue != queue {
			continue
		}
		if status != "" && cas.Status != status {
			continue
		}
		rows = append(rows, cas)
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].CreatedAt.Equal(rows[j].CreatedAt) {
			return rows[i].ID < rows[j].ID
		}
		return rows[i].CreatedAt.Before(rows[j].CreatedAt)
	})
	page, size := pageBounds(query.Page, query.PageSize)
	total := int64(len(rows))
	start, end := pageSlice(page, size, total)
	out := make([]ModerationCase, 0, end-start)
	for _, cas := range rows[start:end] {
		out = append(out, cas.view())
	}
	return CaseList{Cases: out, Total: total, Next: nextPage(page, size, total)}, nil
}

// OpenCase records a staff-opened dispute, report, or fraud-flag case.
func (m *Mem) OpenCase(_ context.Context, actor string, input CaseOpening, now time.Time) (CaseResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, id := newID()
	cas := newStaffCase(id, input.Queue, input.ReasonCode, input.SubjectType, input.SubjectID, input.Details, "", input.EvidenceKeys, now)
	m.cases[cas.ID] = cas
	auditID := m.remember("case.open", subjectCase, cas.ID, actor, input.Details, now)
	return CaseResult{Case: cas.view(), AuditID: auditID}, nil
}

// DecideCase upholds or dismisses an open or pending case and audits the actor.
func (m *Mem) DecideCase(_ context.Context, id, actor string, input CaseDecision, now time.Time) (CaseResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	cas, ok := m.cases[strings.TrimSpace(id)]
	if !ok {
		return CaseResult{}, ErrNotFound
	}
	if err := decideRecord(&cas, input, actor, now); err != nil {
		return CaseResult{}, err
	}
	if cas.ReportID != "" {
		rep, ok := m.reports[cas.ReportID]
		if !ok {
			return CaseResult{}, ErrNotFound
		}
		resolveReport(&rep, input.Decision)
		m.reports[rep.ID] = rep
	}
	m.cases[cas.ID] = cas
	auditID := m.remember("case.decision."+input.Decision, subjectCase, cas.ID, actor, input.Reason, now)
	return CaseResult{Case: cas.view(), AuditID: auditID}, nil
}

// FileReport stores a report, opens its reports-queue case, and audits the actor.
func (m *Mem) FileReport(_ context.Context, actor, idempotencyKey, bodyHash string, input ReportFiling, now time.Time) (ReportResult, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	claimKey := actor + "\x00" + idempotencyKey
	if existing, ok := m.claims[claimKey]; ok {
		if existing.BodyHash != bodyHash {
			return ReportResult{}, false, ErrIdempotency
		}
		if existing.ReportID == "" {
			return ReportResult{}, false, ErrIdempotencyInFlight
		}
		rep, ok := m.reports[existing.ReportID]
		if !ok {
			return ReportResult{}, false, ErrNotFound
		}
		return ReportResult{Report: rep.view(), AuditID: existing.AuditID}, true, nil
	}
	m.claims[claimKey] = reportClaim{Actor: actor, Key: idempotencyKey, BodyHash: bodyHash, CreatedAt: now.UTC()}
	_, reportID := newID()
	_, caseID := newID()
	rep, cas := newReportPair(reportID, caseID, input, now)
	m.cases[cas.ID] = cas
	m.reports[rep.ID] = rep
	auditID := m.remember("report.file", subjectReport, rep.ID, actor, input.Details, now)
	claim := m.claims[claimKey]
	claim.ReportID = rep.ID
	claim.AuditID = auditID
	m.claims[claimKey] = claim
	return ReportResult{Report: rep.view(), AuditID: auditID}, false, nil
}

// ListReports returns filed reports. Empty status means every status.
func (m *Mem) ListReports(_ context.Context, query ReportQuery) (ReportList, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	status := strings.TrimSpace(query.Status)
	rows := make([]storedReport, 0, len(m.reports))
	for _, rep := range m.reports {
		if status != "" && rep.Status != status {
			continue
		}
		rows = append(rows, rep)
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].CreatedAt.Equal(rows[j].CreatedAt) {
			return rows[i].ID < rows[j].ID
		}
		return rows[i].CreatedAt.Before(rows[j].CreatedAt)
	})
	page, size := pageBounds(query.Page, query.PageSize)
	total := int64(len(rows))
	start, end := pageSlice(page, size, total)
	out := make([]Report, 0, end-start)
	for _, rep := range rows[start:end] {
		out = append(out, rep.view())
	}
	return ReportList{Reports: out, Total: total, Next: nextPage(page, size, total)}, nil
}

// AppealReport records the subject's statement inside the 7-day window.
func (m *Mem) AppealReport(_ context.Context, id, actor string, input ReportAppeal, now time.Time) (ReportResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rep, ok := m.reports[strings.TrimSpace(id)]
	if !ok {
		return ReportResult{}, ErrNotFound
	}
	cas, ok := m.cases[rep.CaseID]
	if !ok {
		return ReportResult{}, ErrNotFound
	}
	if err := appealRecord(&rep, &cas, input, now); err != nil {
		return ReportResult{}, err
	}
	m.reports[rep.ID] = rep
	m.cases[cas.ID] = cas
	auditID := m.remember("report.appeal", subjectReport, rep.ID, actor, input.Statement, now)
	return ReportResult{Report: rep.view(), AuditID: auditID}, nil
}

func (m *Mem) remember(action, subjectType, subjectID, actor, note string, now time.Time) string {
	_, id := newID()
	m.audits = append(m.audits, storedAudit{
		Action:      action,
		SubjectType: subjectType,
		SubjectID:   subjectID,
		Actor:       actor,
		Note:        note,
		At:          now.UTC(),
	})
	return id
}
