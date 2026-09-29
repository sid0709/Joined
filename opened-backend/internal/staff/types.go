package staff

import (
	"errors"
	"time"
)

const (
	queueCompanyVerification = "company_verification"

	caseOpen    = "open"
	caseDecided = "decided"

	defaultPageSize = 25
	maxPageSize     = 100
	auditLimit      = 50
	caseHistory     = 20
	verificationSLA = 48 * time.Hour

	subjectCompany = "company"
	subjectCase    = "moderation_case"
	subjectJob     = "direct_job"

	hiringOpen  = "open"
	hiringDraft = "draft"
)

var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("that decision is not available")
	ErrNoChange = errors.New("already in that state")
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

// Page is offset pagination, matching the scout admin lists.
type Page[T any] struct {
	Data     []T   `json:"data"`
	Total    int64 `json:"total"`
	Page     int64 `json:"page"`
	PageSize int64 `json:"page_size"`
}

// Domain is a company email or site domain shown to staff.
type Domain struct {
	Name     string `json:"name"`
	Verified bool   `json:"verified"`
}

// Member is a person on the company.
type Member struct {
	UserID     string `json:"user_id"`
	Name       string `json:"name,omitempty"`
	Email      string `json:"email,omitempty"`
	Role       string `json:"role"`
	HiringRole string `json:"hiring_role,omitempty"`
}

// AuditEntry matches the admin_audit rows scout review already writes.
type AuditEntry struct {
	Action      string    `json:"action" bson:"action"`
	SubjectType string    `json:"subject_type" bson:"subjectType"`
	SubjectID   string    `json:"subject_id" bson:"subjectId"`
	Actor       string    `json:"actor" bson:"actor"`
	Note        string    `json:"note,omitempty" bson:"note,omitempty"`
	At          time.Time `json:"at" bson:"at"`
}

// CompanySummary is one row of the verification queue.
type CompanySummary struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	URL         string    `json:"url,omitempty"`
	Verified    bool      `json:"verified"`
	TrustStatus string    `json:"trust_status"`
	Claimed     bool      `json:"claimed"`
	ClaimMethod string    `json:"claim_method,omitempty"`
	ClaimStatus string    `json:"claim_status,omitempty"`
	Domains     []Domain  `json:"domains"`
	UpdatedAt   time.Time `json:"updated_at,omitempty"`
}

// CompanyDetail is a company plus the evidence staff need to decide.
type CompanyDetail struct {
	CompanySummary
	Logo       string       `json:"logo,omitempty"`
	ClaimedBy  string       `json:"claimed_by,omitempty"`
	Note       string       `json:"note,omitempty"`
	VerifiedAt time.Time    `json:"verified_at,omitempty"`
	Members    []Member     `json:"members"`
	Cases      []Case       `json:"cases"`
	Audit      []AuditEntry `json:"audit"`
}

// Case is one company_verification item in the moderation queue.
type Case struct {
	ID          string    `json:"id"`
	Queue       string    `json:"queue"`
	Status      string    `json:"status"`
	CompanyID   string    `json:"company_id"`
	CompanyName string    `json:"company_name,omitempty"`
	Method      string    `json:"method,omitempty"`
	Domains     []string  `json:"domains"`
	Note        string    `json:"note,omitempty"`
	RequestedBy string    `json:"requested_by,omitempty"`
	SLADueAt    time.Time `json:"sla_due_at"`
	CreatedAt   time.Time `json:"created_at"`
	Decision    string    `json:"decision,omitempty"`
	Reason      string    `json:"reason,omitempty"`
	DecidedBy   string    `json:"decided_by,omitempty"`
	DecidedAt   time.Time `json:"decided_at,omitempty"`
}

// OpenCase starts a company verification case.
type OpenCase struct {
	CompanyID   string   `json:"company_id"`
	Method      string   `json:"method"`
	Domains     []string `json:"domains"`
	Note        string   `json:"note"`
	RequestedBy string   `json:"requested_by"`
}

// DirectJob is a company-posted job in the review queue.
type DirectJob struct {
	ID                    string       `json:"id"`
	Source                string       `json:"source"`
	ListingStatus         string       `json:"listing_status"`
	PreviousListingStatus string       `json:"previous_listing_status,omitempty"`
	TakedownCause         string       `json:"takedown_cause,omitempty"`
	Title                 string       `json:"title"`
	Company               string       `json:"company"`
	CompanyID             string       `json:"company_id"`
	Location              string       `json:"location,omitempty"`
	Workplace             string       `json:"workplace,omitempty"`
	Summary               string       `json:"summary,omitempty"`
	ReviewNote            string       `json:"review_note,omitempty"`
	ReviewedBy            string       `json:"reviewed_by,omitempty"`
	ReviewedAt            time.Time    `json:"reviewed_at,omitempty"`
	PostedAt              time.Time    `json:"posted_at,omitempty"`
	Audit                 []AuditEntry `json:"audit,omitempty"`
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
