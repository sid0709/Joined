package jobscam

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	StatusHeld     = "held"
	StatusApproved = "approved"
	StatusRejected = "rejected"

	DecisionApprove = "approve"
	DecisionReject  = "reject"

	// Listing statuses written back onto the search row. Same strings as jobs.
	ListingActive  = "active"
	ListingRemoved = "removed"

	defaultPageSize = 25
	maxPageSize     = 100
	maxNote         = 1000
	maxActor        = 80
)

const (
	ReasonPayToApply         = "pay_to_apply"
	ReasonOffPlatformContact = "off_platform_contact"
	ReasonCryptoWire         = "crypto_wire"
	ReasonTooGoodPay         = "too_good_pay"
	ReasonMissingDomain      = "missing_company_domain"
	ReasonMismatchedDomain   = "mismatched_company_domain"
	ReasonSuspiciousURL      = "suspicious_url"
	ReasonDuplicateSpam      = "duplicate_spam"
)

var (
	ErrNotFound  = errors.New("not found")
	ErrConflict  = errors.New("that decision is not available")
	ErrInvalidID = errors.New("invalid job id")
)

// Reason is one explainable signal that contributed to the score.
type Reason struct {
	Code    string `json:"code"`
	Detail  string `json:"detail"`
	Weight  int    `json:"weight"`
	Snippet string `json:"snippet,omitempty"`
}

// Result is the deterministic score for one job.
type Result struct {
	Score       int      `json:"score"`
	Threshold   int      `json:"threshold"`
	Hold        bool     `json:"hold"`
	Reasons     []Reason `json:"reasons"`
	Fingerprint string   `json:"fingerprint"`
}

// Input is the posting facts the rules read. Callers map their job record into this.
type Input struct {
	JobID       string
	ListingID   string
	Title       string
	Company     string
	CompanyID   string
	CompanyURL  string
	ApplyURL    string
	Description string
	Summary     string
	Seniority   string
	PayMin      int
	PayMax      int
	PayPeriod   string
	Source      string
	// DuplicateHits is how many other jobs already share this posting fingerprint.
	DuplicateHits int
}

// Decision is what publish does after scoring: hold (hide from search) or remove
// (a staff reject that must stay off the board).
type Decision struct {
	Result
	Remove bool
}

// Hold is one queue row staff see.
type Hold struct {
	ID          string     `json:"id"`
	JobID       string     `json:"jobId"`
	ListingID   string     `json:"listingId,omitempty"`
	Title       string     `json:"title"`
	Company     string     `json:"company"`
	CompanyID   string     `json:"companyId,omitempty"`
	ApplyURL    string     `json:"applyUrl,omitempty"`
	Source      string     `json:"source,omitempty"`
	Score       int        `json:"score"`
	Threshold   int        `json:"threshold"`
	Reasons     []Reason   `json:"reasons"`
	Status      string     `json:"status"`
	Fingerprint string     `json:"fingerprint"`
	HeldAt      time.Time  `json:"heldAt"`
	ReviewedAt  *time.Time `json:"reviewedAt,omitempty"`
	ReviewedBy  string     `json:"reviewedBy,omitempty"`
	ReviewNote  string     `json:"reviewNote,omitempty"`
}

// List is GET /v1/admin/scam-jobs.
type List struct {
	Jobs     []Hold `json:"jobs"`
	Total    int64  `json:"total"`
	Page     int64  `json:"page"`
	PageSize int64  `json:"pageSize"`
	Next     *int64 `json:"next,omitempty"`
}

// ListQuery is the held-jobs feed. Empty status means held only.
type ListQuery struct {
	Status   string
	Page     int64
	PageSize int64
}

// Review is POST /v1/admin/scam-jobs/{id}/review.
type Review struct {
	Decision string `json:"decision"`
	Reason   string `json:"reason"`
}

// FieldError is one invalid input, same shape as other staff APIs.
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

// Normalize checks approve/reject and requires a reason.
func (r *Review) Normalize() error {
	r.Decision = strings.TrimSpace(r.Decision)
	r.Reason = strings.TrimSpace(r.Reason)
	var fields []FieldError
	switch r.Decision {
	case DecisionApprove, DecisionReject:
	default:
		fields = append(fields, FieldError{Field: "decision", Detail: "use approve or reject"})
	}
	if r.Reason == "" {
		fields = append(fields, FieldError{Field: "reason", Detail: "a reason is required"})
	}
	if utf8.RuneCountInString(r.Reason) > maxNote {
		fields = append(fields, FieldError{Field: "reason", Detail: "reason is too long"})
	}
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
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

func clipActor(actor string) string {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return "admin"
	}
	if len(actor) > maxActor {
		return actor[:maxActor]
	}
	return actor
}

func holdID(in Input) string {
	if id := strings.TrimSpace(in.JobID); id != "" {
		return id
	}
	return strings.TrimSpace(in.ListingID)
}
