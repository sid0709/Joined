// Package fitscore scores a job against a job hunter's profile.
//
// The scorer is deterministic: title, skills, seniority, location, and salary
// overlap. Missing profile or job fields are skipped, the remaining weights
// are scaled to 100, and the reason notes low confidence.
package fitscore

import "context"

const (
	// ModelVersion is stored on every result so later models can coexist.
	ModelVersion = "fitscore-v1"

	ConfidenceHigh = "high"
	ConfidenceLow  = "low"

	weightTitle     = 30
	weightSkills    = 25
	weightSeniority = 15
	weightLocation  = 15
	weightSalary    = 15

	partialCredit  = 0.5
	payTolerance   = 0.85
	hoursPerYear   = 2080
	minDimensions  = 3
	maxReasonRunes = 240

	sponsorshipRequired = "us-sponsor"
	remotePrefix        = "remote"

	levelYes     = "yes"
	levelPartial = "partial"
	levelNo      = "no"
)

// Job is the posting fields the scorer reads. It is a copy so this package
// does not import jobs (other roadmap steps own that response struct).
type Job struct {
	ID        string
	Title     string
	Location  string
	Workplace string
	Seniority string
	Skills    []string
	PayMin    int
	PayMax    int
	PayPeriod string
	Currency  string
	Visa      bool
}

// Profile is the hunter fields the scorer reads. Empty slices and zero pay
// mean "not provided", not a mismatch.
type Profile struct {
	Headline         string
	TargetRoles      []string
	Locations        []string
	Location         string
	Workplace        string
	SalaryFloor      int
	Skills           []string
	Authorization    string
	ExperienceTitles []string
}

// Criterion is one scored dimension, for display and tests.
type Criterion struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Detail string `json:"detail"`
	Level  string `json:"level"`
}

// Result is the API payload for one job.
type Result struct {
	Score        int         `json:"score"`
	Reason       string      `json:"reason"`
	Confidence   string      `json:"confidence"`
	ModelVersion string      `json:"modelVersion"`
	Criteria     []Criterion `json:"criteria"`
	NeedsVisa    bool        `json:"needsVisa"`
}

// Catalog loads a job for scoring. Tests use Memory.
type Catalog interface {
	Job(ctx context.Context, id string) (Job, error)
}

// Profiles loads a hunter profile for scoring. Tests use Memory.
type Profiles interface {
	Profile(ctx context.Context, userID string) (Profile, error)
}

// Reasoner can rewrite Result.Reason when Acorn AI is on. A failure must
// leave the deterministic reason in place.
type Reasoner interface {
	Rewrite(ctx context.Context, job Job, profile Profile, result Result) (string, error)
}
