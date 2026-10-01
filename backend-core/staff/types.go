package staff

import (
	"errors"
	"time"
)

const (
	defaultPageSize = 25
	maxPageSize     = 100
	auditLimit      = 50
	verificationSLA = 48 * time.Hour
	maxNote         = 1000

	subjectCompany = "company"
	subjectJob     = "direct_job"
	subjectCase    = "case"
	subjectReport  = "report"

	verificationsCollection = "company_verifications"
	auditCollection         = "admin_audit"
	membersCollection       = "company_members"
	usersCollection         = "users"
	casesCollection         = "moderation_cases"
	reportsCollection       = "reports"
	reportClaimsCollection  = "report_idempotency"
)

var (
	ErrNotFound            = errors.New("not found")
	ErrConflict            = errors.New("that decision is not available")
	ErrIdempotency         = errors.New("Idempotency-Key was already used with a different request body")
	ErrIdempotencyInFlight = errors.New("a request with this Idempotency-Key is still in progress")
)

// FieldError is one invalid input, in the same shape as the scout admin API.
type FieldError struct {
	Field  string `json:"field"`
	Detail string `json:"detail"`
}

// ValidationError is a 422 body.
type ValidationError struct {
	Fields []FieldError
}

func (e *ValidationError) Error() string {
	return "validation failed"
}

// Verification is one company_verifications queue row.
type Verification struct {
	ID          string     `json:"id"`
	CompanyID   string     `json:"companyId"`
	CompanyName string     `json:"companyName"`
	ClaimMethod string     `json:"claimMethod"`
	RequestedBy string     `json:"requestedBy"`
	Domains     []string   `json:"domains"`
	MemberCount int64      `json:"memberCount"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"createdAt"`
	SLAAt       *time.Time `json:"slaAt,omitempty"`
}

// VerificationList is GET /v1/admin/companies/verifications.
type VerificationList struct {
	Data  []Verification `json:"data"`
	Total int64          `json:"total"`
	Next  *int64         `json:"next,omitempty"`
}

// PendingCount is GET /v1/admin/companies/verifications/pending-count.
type PendingCount struct {
	Pending int64 `json:"pending"`
}

// Member is a person on the company.
type Member struct {
	UserID     string `json:"userId"`
	Name       string `json:"name,omitempty"`
	Email      string `json:"email,omitempty"`
	Role       string `json:"role"`
	HiringRole string `json:"hiringRole,omitempty"`
}

// PendingClaim is the open verification record while the company is pending.
type PendingClaim struct {
	ID          string     `json:"id,omitempty"`
	ClaimMethod string     `json:"claimMethod"`
	RequestedBy string     `json:"requestedBy"`
	Domains     []string   `json:"domains"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"createdAt"`
	SLAAt       *time.Time `json:"slaAt,omitempty"`
}

// AuditEntry matches admin_audit. BSON names are the scout audit fields.
type AuditEntry struct {
	Action      string    `json:"action" bson:"action"`
	SubjectType string    `json:"subjectType" bson:"subjectType"`
	SubjectID   string    `json:"subjectId" bson:"subjectId"`
	Actor       string    `json:"actor" bson:"actor"`
	Note        string    `json:"note,omitempty" bson:"note,omitempty"`
	At          time.Time `json:"at" bson:"at"`
}

// CompanyDetail is GET /v1/admin/companies/{id}.
type CompanyDetail struct {
	ID                 string        `json:"id"`
	CompanyName        string        `json:"companyName"`
	CompanyURL         string        `json:"companyUrl,omitempty"`
	Domains            []string      `json:"domains"`
	Members            []Member      `json:"members"`
	ClaimMethod        string        `json:"claimMethod"`
	Claimed            bool          `json:"claimed"`
	VerificationStatus string        `json:"verificationStatus"`
	PendingClaim       *PendingClaim `json:"pendingClaim,omitempty"`
	VerifiedAt         *time.Time    `json:"verifiedAt,omitempty"`
	SuspendedAt        *time.Time    `json:"suspendedAt,omitempty"`
	Audit              []AuditEntry  `json:"audit,omitempty"`
}

// VerifyResult is POST /v1/admin/companies/{id}/verify.
type VerifyResult struct {
	Company CompanyDetail `json:"company"`
	AuditID string        `json:"auditId"`
}

// DirectJob is one hiring job in GET /v1/admin/jobs.
type DirectJob struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	CompanyID   string     `json:"companyId"`
	CompanyName string     `json:"companyName"`
	Source      string     `json:"source"`
	Status      string     `json:"status"`
	PostedAt    *time.Time `json:"postedAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	Location    string     `json:"location,omitempty"`
}

// JobList is GET /v1/admin/jobs.
type JobList struct {
	Jobs  []DirectJob `json:"jobs"`
	Total int64       `json:"total"`
	Next  *int64      `json:"next,omitempty"`
}

// JobResult is POST review and POST takedown.
type JobResult struct {
	Job     DirectJob `json:"job"`
	AuditID string    `json:"auditId"`
}

func pageBounds(page, size int64) (int64, int64) {
	if page < 1 {
		page = 1
	}
	if size < 1 {
		size = defaultPageSize
	}
	if size > maxPageSize {
		size = maxPageSize
	}
	return page, size
}

func nextPage(page, size, total int64) *int64 {
	if page*size < total {
		n := page + 1
		return &n
	}
	return nil
}

func timePtr(value time.Time) *time.Time {
	if value.IsZero() {
		return nil
	}
	utc := value.UTC()
	return &utc
}

func stringsOrEmpty(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
