package jobs

import (
	"context"
	"time"
)

const (
	// AthensSourceID is the existing Athens → temp_jobs feed. It stays registered
	// and off until JOB_IMPORT_SOURCES lists it.
	AthensSourceID = "athens"
	// FakeSourceID is the in-memory feed used by tests. It is never registered in
	// production.
	FakeSourceID = "fake"

	ImportRunDisabled = "disabled"
	ImportRunLocked   = "locked"
	ImportRunOK       = "ok"
	ImportRunFailed   = "failed"
	ImportRunPartial  = "partial"
	ImportRunKilled   = "killed"

	importDisabledReason       = "job import is disabled"
	importLockedReason         = "another import run holds the lock"
	importSourceDisabledReason = "source is disabled"
	importKilledReason         = "import kill switch blocked this source"
	importLockDocumentID       = "scheduled-job-import"
	defaultImportRecentLimit   = 20
	defaultImportInterval      = time.Hour
)

// ImportRecord is one feed item after a source returns it and before it is
// written to temp_jobs.
type ImportRecord struct {
	ExternalID  string
	Company     string
	Title       string
	Location    string
	ApplyURL    string
	Source      string
	PostedAt    time.Time
	Description string
}

// ImportStats is the per-source or whole-run count of feed items.
type ImportStats struct {
	Fetched  int `json:"fetched"`
	Inserted int `json:"inserted"`
	Replaced int `json:"replaced"`
	Skipped  int `json:"skipped"`
	Failed   int `json:"failed"`
}

// SourceStats is one source's outcome inside a run.
type SourceStats struct {
	SourceID string `json:"sourceId"`
	Enabled  bool   `json:"enabled"`
	Reason   string `json:"reason,omitempty"`
	Error    string `json:"error,omitempty"`
	ImportStats
}

// ImportRun is one scheduler pass, stored in the run log.
type ImportRun struct {
	ID        string        `json:"id" bson:"_id"`
	StartedAt time.Time     `json:"startedAt" bson:"startedAt"`
	EndedAt   time.Time     `json:"endedAt" bson:"endedAt"`
	Status    string        `json:"status" bson:"status"`
	Reason    string        `json:"reason,omitempty" bson:"reason,omitempty"`
	Sources   []SourceStats `json:"sources" bson:"sources"`
	Totals    ImportStats   `json:"totals" bson:"totals"`
}

// SourceStatus is the registry row the admin recent-runs payload shows.
type SourceStatus struct {
	ID      string `json:"id"`
	Enabled bool   `json:"enabled"`
}

// ImportRunsResponse is the read-only admin recent-runs payload.
type ImportRunsResponse struct {
	Enabled bool           `json:"enabled"`
	Sources []SourceStatus `json:"sources"`
	Runs    []ImportRun    `json:"runs"`
}

// ImportSource is a permitted feed. Production registers Athens; tests use FakeSource.
type ImportSource interface {
	ID() string
	Enabled() bool
	Fetch(ctx context.Context) ([]ImportRecord, error)
}

// ImportSink writes an accepted feed item onto the existing temp_jobs path.
type ImportSink interface {
	Stage(ctx context.Context, rec ImportRecord) error
}

// ImportRunLog stores and lists scheduled import runs.
type ImportRunLog interface {
	Append(ctx context.Context, run ImportRun) error
	Recent(ctx context.Context, limit int) ([]ImportRun, error)
}
