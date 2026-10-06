package jobs

import (
	"context"
	"strings"
	"sync"
)

// SourceRegistry is the permitted-feed list. Each source has its own enabled flag.
type SourceRegistry struct {
	mu      sync.RWMutex
	sources []ImportSource
}

func NewSourceRegistry() *SourceRegistry {
	return &SourceRegistry{}
}

func (r *SourceRegistry) Register(source ImportSource) {
	if r == nil || source == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.sources = append(r.sources, source)
}

func (r *SourceRegistry) Sources() []ImportSource {
	if r == nil {
		return nil
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]ImportSource, len(r.sources))
	copy(out, r.sources)
	return out
}

func (r *SourceRegistry) Status() []SourceStatus {
	sources := r.Sources()
	out := make([]SourceStatus, 0, len(sources))
	for _, source := range sources {
		out = append(out, SourceStatus{ID: source.ID(), Enabled: source.Enabled()})
	}
	return out
}

// FakeSource is an in-memory feed for tests. It is not registered in production.
type FakeSource struct {
	Name    string
	On      bool
	Records []ImportRecord
	Err     error

	mu      sync.Mutex
	Fetches int
}

func (f *FakeSource) ID() string {
	if f == nil || f.Name == "" {
		return FakeSourceID
	}
	return f.Name
}

func (f *FakeSource) Enabled() bool {
	return f != nil && f.On
}

func (f *FakeSource) Fetch(ctx context.Context) ([]ImportRecord, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	f.mu.Lock()
	f.Fetches++
	f.mu.Unlock()
	if f.Err != nil {
		return nil, f.Err
	}
	return append([]ImportRecord(nil), f.Records...), nil
}

func (f *FakeSource) FetchCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.Fetches
}

// AthensSource reads the existing source collection (the same feed Copy uses)
// and maps each document onto an ImportRecord.
type AthensSource struct {
	store   *Store
	enabled bool
}

func NewAthensSource(store *Store, enabled bool) *AthensSource {
	return &AthensSource{store: store, enabled: enabled}
}

func (a *AthensSource) ID() string {
	return AthensSourceID
}

func (a *AthensSource) Enabled() bool {
	if a == nil || a.store == nil {
		return false
	}
	if enabled, ok := SourceEnabled(a.ID()); ok {
		return enabled
	}
	return a.enabled
}

func (a *AthensSource) Fetch(ctx context.Context) ([]ImportRecord, error) {
	if a == nil || a.store == nil {
		return nil, ErrInvalidInput
	}
	return a.store.fetchAthensRecords(ctx)
}

func (r ImportRecord) Normalize() ImportRecord {
	r.Company = strings.TrimSpace(r.Company)
	r.Title = strings.TrimSpace(r.Title)
	r.Location = strings.TrimSpace(r.Location)
	r.ApplyURL = CanonicalApplyURL(r.ApplyURL)
	r.Source = strings.TrimSpace(r.Source)
	r.ExternalID = strings.TrimSpace(r.ExternalID)
	r.Description = strings.TrimSpace(r.Description)
	if r.ExternalID == "" {
		r.ExternalID = r.ApplyURL
	}
	return r
}

func (r ImportRecord) Valid() bool {
	return r.Title != "" && r.Company != "" && r.ApplyURL != ""
}

func (r ImportRecord) DedupeRecord() DedupeRecord {
	rec := DedupeRecord{
		JobID:    r.ExternalID,
		Company:  r.Company,
		Title:    r.Title,
		Location: r.Location,
		ApplyURL: r.ApplyURL,
		Source:   r.Source,
		PostedAt: r.PostedAt,
	}
	rec.DedupeKey = rec.Key()
	return rec
}

func recordFromTemp(listing tempListing) ImportRecord {
	source := strings.TrimSpace(listing.Source)
	if source == "" {
		source = AthensSourceID
	}
	ref := strings.TrimSpace(listing.SourceRef)
	if ref == "" && !listing.ID.IsZero() {
		ref = listing.ID.Hex()
	}
	return ImportRecord{
		ExternalID:  ref,
		Company:     listing.CompanyName,
		Title:       listing.Title,
		Location:    listing.Metadata.Details.Location,
		ApplyURL:    listing.ApplyLink,
		Source:      source,
		PostedAt:    listing.PostedAt,
		Description: listing.Description,
	}
}
