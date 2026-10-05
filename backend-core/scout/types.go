// Package scout runs the Scoutwell side of the job pool: scouts (people or
// outsourcing partners over the API) submit official job links, automatic
// checks decide what needs a moderator, and approved jobs are published into
// the Joined search pool. Scouts earn on what their jobs produce.
package scout

import (
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"

	"github.com/sid0709/OpenSeat/backend-core/jobschema"
)

// Submission statuses, in pipeline order. See docs/13-platform-scout.md.
const (
	StatusSubmitted    = "submitted"
	StatusAutoChecking = "auto_checking"
	StatusNeedsReview  = "needs_review"
	StatusApproved     = "approved"
	StatusRejected     = "rejected"
	StatusDuplicate    = "duplicate"
)

// Check outcomes. A fail rejects, review sends the job to a moderator, flag is
// informational (it can lower a reward but never blocks).
const (
	OutcomePass   = "pass"
	OutcomeFail   = "fail"
	OutcomeReview = "review"
	OutcomeFlag   = "flag"
)

// Rejection reason codes shown to scouts and API clients.
const (
	ReasonNotOfficial = "not_official_source"
	ReasonUnreachable = "unreachable"
	ReasonClosed      = "position_closed"
	ReasonScam        = "scam_signals"
	ReasonDuplicate   = "duplicate"
	ReasonModerator   = "moderator_decision"
)

// Where a submission came from.
const (
	ChannelWeb = "web"
	ChannelAPI = "api"
)

// Workplace, employment, and seniority values match the Joined search record
// (packages/job-schema). Older submissions may still say entry, mid, or senior;
// CanonicalSeniority folds those onto Junior, Middle, and Senior.
const (
	WorkplaceRemote = jobschema.WorkplaceRemote
	WorkplaceHybrid = jobschema.WorkplaceHybrid
	WorkplaceOnsite = jobschema.WorkplaceOnsite

	EmploymentFullTime = jobschema.EmploymentFullTime
	EmploymentContract = jobschema.EmploymentContract
	EmploymentPartTime = jobschema.EmploymentPartTime

	SeniorityJunior  = jobschema.SeniorityJunior
	SeniorityMiddle  = jobschema.SeniorityMiddle
	SenioritySenior  = jobschema.SenioritySenior
	SeniorityLeader  = jobschema.SeniorityLeader
	SeniorityManager = jobschema.SeniorityManager
)

// Scout identity verification states. Tier 2 (verified) unlocks payouts.
const (
	VerificationNone     = "none"
	VerificationPending  = "pending"
	VerificationVerified = "verified"
	VerificationRejected = "rejected"
)

// Earning and payout lifecycles.
const (
	EarningHeld       = "held"
	EarningReleased   = "released"
	EarningPaid       = "paid"
	EarningClawedBack = "clawed_back"

	RewardApproval   = "approval"
	RewardApply      = "apply"
	RewardInterview  = "interview"
	RewardHire       = "hire"
	RewardConversion = "conversion"

	PayoutRequested = "requested"
	PayoutApproved  = "approved"
	PayoutSent      = "sent"
	PayoutPaid      = "paid"
	PayoutFailed    = "failed"
	PayoutRejected  = "rejected"
)

var (
	ErrNotFound          = errors.New("not found")
	ErrInvalidInput      = errors.New("check the form and try again")
	ErrForbidden         = errors.New("not allowed")
	ErrNotScout          = errors.New("this account is not a scout")
	ErrTermsRequired     = errors.New("accept the scout terms before submitting jobs")
	ErrQuotaExceeded     = errors.New("daily submission limit reached")
	ErrConflict          = errors.New("conflict")
	ErrIdempotency       = errors.New("Idempotency-Key was already used with a different request body")
	ErrPayoutBlocked     = errors.New("payout requirements are not met")
	ErrPayoutNotApproved = errors.New("payout has not been approved by staff")
	ErrKeyLimit          = errors.New("revoke an API key before creating another")
	ErrNotDecidable      = errors.New("this submission is not waiting on a decision")
	ErrAlreadyDecided    = errors.New("this item was already decided")
)

// FieldError explains one invalid input field (RFC 9457 extension member).
type FieldError struct {
	Field  string `json:"field"`
	Detail string `json:"detail"`
}

// ValidationError carries every field problem found in one request.
type ValidationError struct {
	Fields []FieldError
}

func (e *ValidationError) Error() string { return "validation failed" }

func (e *ValidationError) add(field, detail string) {
	e.Fields = append(e.Fields, FieldError{Field: field, Detail: detail})
}

func (e *ValidationError) orNil() error {
	if len(e.Fields) == 0 {
		return nil
	}
	return e
}

// ConflictError points at the record that already owns the request.
type ConflictError struct {
	Detail     string
	ExistingID string
}

func (e *ConflictError) Error() string { return e.Detail }
func (e *ConflictError) Unwrap() error { return ErrConflict }

// Money follows docs/60-api-conventions.md.
type Money struct {
	AmountCents int64  `json:"amount_cents" bson:"amountCents"`
	Currency    string `json:"currency" bson:"currency"`
}

// Pay is the job-record salary range. Zero min and max means not listed.
type Pay struct {
	Min      int    `json:"min" bson:"min"`
	Max      int    `json:"max" bson:"max"`
	Currency string `json:"currency" bson:"currency"`
	Period   string `json:"period" bson:"period"`
}

// Check is one automatic check result stored on a submission.
type Check struct {
	ID      string `json:"id" bson:"id"`
	Label   string `json:"label" bson:"label"`
	Outcome string `json:"outcome" bson:"outcome"`
	Detail  string `json:"detail" bson:"detail"`
}

// SubmissionInput is what a scout (web form or API client) sends.
type SubmissionInput struct {
	URL               string `json:"url"`
	CompanyName       string `json:"company_name"`
	Title             string `json:"title"`
	LocationText      string `json:"location_text"`
	CompanyID         string `json:"company_id"`
	Workplace         string `json:"workplace"`
	Employment        string `json:"employment"`
	Seniority         string `json:"seniority"`
	Pay               Pay    `json:"pay"`
	Equity            bool   `json:"equity"`
	SalaryText        string `json:"salary"`
	Summary           string `json:"summary"`
	NotDuplicateClaim bool   `json:"not_duplicate_claim"`
	ExternalRef       string `json:"external_ref"`
}

// ExtensionSubmissionInput is what the Scout extension sends (step-13 captured job shape).
type ExtensionSubmissionInput struct {
	Title       string `json:"title"`
	Company     string `json:"company"`
	Location    string `json:"location"`
	ApplyURL    string `json:"apply_url"`
	Description string `json:"description"`
	Board       string `json:"board"`
}

// Submission is a scout's job link and everything the pipeline learned about it.
type Submission struct {
	ObjectID        bson.ObjectID `json:"-" bson:"_id"`
	ID              string        `json:"id" bson:"-"`
	ScoutUserID     string        `json:"scout_user_id" bson:"scoutUserId"`
	Channel         string        `json:"channel" bson:"channel"`
	APIKeyID        string        `json:"api_key_id,omitempty" bson:"apiKeyId,omitempty"`
	ExternalRef     string        `json:"external_ref,omitempty" bson:"externalRef,omitempty"`
	URL             string        `json:"url" bson:"url"`
	CanonicalURL    string        `json:"canonical_url" bson:"canonicalUrl"`
	FinalURL        string        `json:"final_url,omitempty" bson:"finalUrl,omitempty"`
	Host            string        `json:"host" bson:"host"`
	ATS             string        `json:"ats,omitempty" bson:"ats,omitempty"`
	CompanyName     string        `json:"company_name" bson:"companyName"`
	CompanyID       string        `json:"company_id,omitempty" bson:"companyId,omitempty"`
	Title           string        `json:"title" bson:"title"`
	LocationText    string        `json:"location_text" bson:"locationText"`
	Workplace       string        `json:"workplace" bson:"workplace"`
	Employment      string        `json:"employment" bson:"employment"`
	Seniority       string        `json:"seniority" bson:"seniority"`
	Pay             Pay           `json:"pay" bson:"pay"`
	Equity          bool          `json:"equity" bson:"equity"`
	SalaryText      string        `json:"salary" bson:"salaryText"`
	Summary         string        `json:"summary" bson:"summary"`
	DedupeKey       string        `json:"-" bson:"dedupeKey"`
	Status          string        `json:"status" bson:"status"`
	RejectionCode   string        `json:"rejection_code,omitempty" bson:"rejectionCode,omitempty"`
	RejectionReason string        `json:"rejection_reason,omitempty" bson:"rejectionReason,omitempty"`
	Checks          []Check       `json:"auto_check_results" bson:"checks"`
	DuplicateOf     string        `json:"duplicate_of,omitempty" bson:"duplicateOf,omitempty"`
	DuplicateClaim  bool          `json:"duplicate_claim,omitempty" bson:"duplicateClaim,omitempty"`
	Matches         []Match       `json:"matches,omitempty" bson:"matches,omitempty"`
	HiddenJob       bool          `json:"hidden_job" bson:"hiddenJob"`
	SpotCheck       bool          `json:"spot_check,omitempty" bson:"spotCheck,omitempty"`
	JobID           string        `json:"job_id,omitempty" bson:"jobId,omitempty"`
	JobRef          string        `json:"-" bson:"jobRef,omitempty"`
	TempJobID       string        `json:"temp_job_id,omitempty" bson:"tempJobId,omitempty"`
	ReviewedBy      string        `json:"reviewed_by,omitempty" bson:"reviewedBy,omitempty"`
	ReviewedAt      *time.Time    `json:"reviewed_at,omitempty" bson:"reviewedAt,omitempty"`
	ReviewNote      string        `json:"review_note,omitempty" bson:"reviewNote,omitempty"`
	Expired         bool          `json:"expired" bson:"expired"`
	ExpiredAt       *time.Time    `json:"expired_at,omitempty" bson:"expiredAt,omitempty"`
	Interviews      int           `json:"settled_interviews" bson:"settledInterviews"`
	Hires           int           `json:"hires" bson:"hires"`
	Activity        JobActivity   `json:"activity" bson:"-"`
	SubmittedAt     time.Time     `json:"submitted_at" bson:"submittedAt"`
	CheckedAt       *time.Time    `json:"checked_at,omitempty" bson:"checkedAt,omitempty"`
	UpdatedAt       time.Time     `json:"updated_at" bson:"updatedAt"`
}

// JobActivity is live usage of a published job in Joined.
type JobActivity struct {
	Applications int `json:"applications"`
	Interviews   int `json:"interviews"`
}

// Profile is the scout side of an account.
type Profile struct {
	UserID             string        `json:"user_id" bson:"userId"`
	Name               string        `json:"name" bson:"-"`
	Email              string        `json:"email" bson:"-"`
	Level              string        `json:"level" bson:"level"`
	LevelPinned        bool          `json:"level_pinned" bson:"levelPinned"`
	TermsAcceptedAt    *time.Time    `json:"terms_accepted_at" bson:"termsAcceptedAt,omitempty"`
	Verification       string        `json:"verification" bson:"verification"`
	VerificationNote   string        `json:"verification_note,omitempty" bson:"verificationNote,omitempty"`
	LegalName          string        `json:"legal_name,omitempty" bson:"legalName,omitempty"`
	Country            string        `json:"country,omitempty" bson:"country,omitempty"`
	DateOfBirth        string        `json:"date_of_birth,omitempty" bson:"dateOfBirth,omitempty"`
	DocumentRef        string        `json:"document_ref,omitempty" bson:"documentRef,omitempty"`
	VerifiedBy         string        `json:"verified_by,omitempty" bson:"verifiedBy,omitempty"`
	TaxInfo            *TaxInfo      `json:"tax_info" bson:"taxInfo,omitempty"`
	PayoutMethod       *PayoutMethod `json:"payout_method" bson:"payoutMethod,omitempty"`
	NotifyDecisions    bool          `json:"notify_decisions" bson:"notifyDecisions"`
	NotifyRewards      bool          `json:"notify_rewards" bson:"notifyRewards"`
	VerificationTier   int           `json:"verification_tier" bson:"-"`
	CreatedAt          time.Time     `json:"created_at" bson:"createdAt"`
	UpdatedAt          time.Time     `json:"updated_at" bson:"updatedAt"`
	VerificationUpdate *time.Time    `json:"verification_updated_at,omitempty" bson:"verificationUpdatedAt,omitempty"`
}

// TaxInfo keeps only what payouts need to show; full tax IDs are never stored.
type TaxInfo struct {
	LegalName   string    `json:"legal_name" bson:"legalName"`
	Country     string    `json:"country" bson:"country"`
	TaxIDLast4  string    `json:"tax_id_last4" bson:"taxIdLast4"`
	CompletedAt time.Time `json:"completed_at" bson:"completedAt"`
}

// PayoutMethod is a masked destination. Raw bank numbers are never stored;
// the provider's opaque recipient id is preferred after create-recipient.
type PayoutMethod struct {
	Type        string    `json:"type" bson:"type"`
	Label       string    `json:"label" bson:"label"`
	Last4       string    `json:"last4" bson:"last4"`
	HolderName  string    `json:"holder_name,omitempty" bson:"holderName,omitempty"`
	Country     string    `json:"country,omitempty" bson:"country,omitempty"`
	Currency    string    `json:"currency,omitempty" bson:"currency,omitempty"`
	Email       string    `json:"email,omitempty" bson:"email,omitempty"`
	AccountRef  string    `json:"account_ref,omitempty" bson:"accountRef,omitempty"`
	RecipientID string    `json:"recipient_id,omitempty" bson:"recipientId,omitempty"`
	UpdatedAt   time.Time `json:"updated_at" bson:"updatedAt"`
}

// Earning is one reward line. Held rewards release after the hold window.
type Earning struct {
	ObjectID     bson.ObjectID `json:"-" bson:"_id"`
	ID           string        `json:"id" bson:"-"`
	ScoutUserID  string        `json:"scout_user_id" bson:"scoutUserId"`
	SubmissionID string        `json:"submission_id,omitempty" bson:"submissionId,omitempty"`
	JobID        string        `json:"job_id,omitempty" bson:"jobId,omitempty"`
	CandidateID  string        `json:"candidate_id,omitempty" bson:"candidateId,omitempty"`
	JobTitle     string        `json:"job_title,omitempty" bson:"jobTitle,omitempty"`
	CompanyName  string        `json:"company_name,omitempty" bson:"companyName,omitempty"`
	Type         string        `json:"type" bson:"type"`
	Amount       Money         `json:"amount" bson:"amount"`
	Status       string        `json:"status" bson:"status"`
	Description  string        `json:"description" bson:"description"`
	HoldUntil    time.Time     `json:"hold_until" bson:"holdUntil"`
	PayoutID     string        `json:"payout_id,omitempty" bson:"payoutId,omitempty"`
	CreatedAt    time.Time     `json:"created_at" bson:"createdAt"`
	ReleasedAt   *time.Time    `json:"released_at,omitempty" bson:"releasedAt,omitempty"`
	PaidAt       *time.Time    `json:"paid_at,omitempty" bson:"paidAt,omitempty"`
}

// Payout moves released earnings to the scout's payout method.
type Payout struct {
	ObjectID        bson.ObjectID `json:"-" bson:"_id"`
	ID              string        `json:"id" bson:"-"`
	ScoutUserID     string        `json:"scout_user_id" bson:"scoutUserId"`
	ScoutName       string        `json:"scout_name,omitempty" bson:"-"`
	ScoutEmail      string        `json:"scout_email,omitempty" bson:"-"`
	Amount          Money         `json:"amount" bson:"amount"`
	Method          PayoutMethod  `json:"method" bson:"method"`
	EarningIDs      []string      `json:"earning_ids" bson:"earningIds"`
	Status          string        `json:"status" bson:"status"`
	Note            string        `json:"note,omitempty" bson:"note,omitempty"`
	ProviderRef     string        `json:"provider_ref,omitempty" bson:"providerRef,omitempty"`
	ProviderStatus  string        `json:"provider_status,omitempty" bson:"providerStatus,omitempty"`
	ProviderEventID string        `json:"provider_event_id,omitempty" bson:"providerEventId,omitempty"`
	RequestedAt     time.Time     `json:"requested_at" bson:"requestedAt"`
	ApprovedAt      *time.Time    `json:"approved_at,omitempty" bson:"approvedAt,omitempty"`
	SentAt          *time.Time    `json:"sent_at,omitempty" bson:"sentAt,omitempty"`
	FailedAt        *time.Time    `json:"failed_at,omitempty" bson:"failedAt,omitempty"`
	DecidedAt       *time.Time    `json:"decided_at,omitempty" bson:"decidedAt,omitempty"`
}

// Notification tells a scout about a decision, reward, or level change.
type Notification struct {
	ObjectID    bson.ObjectID `json:"-" bson:"_id"`
	ID          string        `json:"id" bson:"-"`
	ScoutUserID string        `json:"-" bson:"scoutUserId"`
	Kind        string        `json:"kind" bson:"kind"`
	Tone        string        `json:"tone" bson:"tone"`
	Title       string        `json:"title" bson:"title"`
	Body        string        `json:"body" bson:"body"`
	SubjectID   string        `json:"subject_id,omitempty" bson:"subjectId,omitempty"`
	Event       string        `json:"event,omitempty" bson:"event,omitempty"`
	Key         string        `json:"-" bson:"key,omitempty"`
	Read        bool          `json:"read" bson:"read"`
	CreatedAt   time.Time     `json:"created_at" bson:"createdAt"`
}

// List is cursor pagination per docs/60-api-conventions.md.
type List[T any] struct {
	Data       []T    `json:"data"`
	NextCursor string `json:"next_cursor"`
}

// AdminList is offset pagination for the admin console tables.
type AdminList[T any] struct {
	Data     []T   `json:"data"`
	Total    int64 `json:"total"`
	Page     int64 `json:"page"`
	PageSize int64 `json:"page_size"`
}

func (s *Submission) fill() {
	s.ID = s.ObjectID.Hex()
	if s.Checks == nil {
		s.Checks = []Check{}
	}
	if s.Matches == nil {
		s.Matches = []Match{}
	}
	if canonical, ok := jobschema.CanonicalSeniority(s.Seniority); ok {
		s.Seniority = canonical
	}
	if s.Equity {
		s.Pay.Min = 0
		s.Pay.Max = 0
		s.SalaryText = ""
		return
	}
	s.Pay = canonicalPay(s.Pay, s.SalaryText)
	if s.Pay.Min != 0 || s.Pay.Max != 0 {
		s.SalaryText = salaryLabel(s.Pay)
	}
}

func (e *Earning) fill()      { e.ID = e.ObjectID.Hex() }
func (p *Payout) fill()       { p.ID = p.ObjectID.Hex() }
func (n *Notification) fill() { n.ID = n.ObjectID.Hex() }
