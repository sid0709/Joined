package staff

import (
	"context"
	"time"
)

// API is the staff surface the HTTP server calls. Store is the Mongo
// implementation. Mem is the in-memory implementation used by tests.
type API interface {
	ListVerifications(ctx context.Context, query VerificationQuery) (VerificationList, error)
	PendingVerifications(ctx context.Context) (PendingCount, error)
	Company(ctx context.Context, id string) (CompanyDetail, error)
	VerifyCompany(ctx context.Context, id, actor string, input CompanyVerify, now time.Time) (VerifyResult, error)
	NoteCompanyCreated(ctx context.Context, companyID, userID, website string, now time.Time) error
	ListDirectJobs(ctx context.Context, query JobQuery) (JobList, error)
	ReviewDirectJob(ctx context.Context, id, actor string, input JobReview, now time.Time) (JobResult, error)
	TakedownDirectJob(ctx context.Context, id, actor, reason string, now time.Time) (JobResult, error)
	ListCases(ctx context.Context, query CaseQuery) (CaseList, error)
	OpenCase(ctx context.Context, actor string, input CaseOpening, now time.Time) (CaseResult, error)
	DecideCase(ctx context.Context, id, actor string, input CaseDecision, now time.Time) (CaseResult, error)
	FileReport(ctx context.Context, actor, idempotencyKey, bodyHash string, input ReportFiling, now time.Time) (ReportResult, bool, error)
	ListReports(ctx context.Context, query ReportQuery) (ReportList, error)
	AppealReport(ctx context.Context, id, actor string, input ReportAppeal, now time.Time) (ReportResult, error)
	WriteAudit(ctx context.Context, action, subjectType, subjectID, actor, note string, now time.Time) (string, error)
	AuditsFor(ctx context.Context, subjectID string) ([]AuditEntry, error)
}

var (
	_ API = (*Store)(nil)
	_ API = (*Mem)(nil)
)
