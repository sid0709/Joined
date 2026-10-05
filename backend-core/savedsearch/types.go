// Package savedsearch persists a signed-in user's saved job searches and
// exposes the hook a future alert sender uses to list searches due for mail.
// This package does not send email.
package savedsearch

import (
	"strings"
	"time"
	"unicode/utf8"
)

const (
	// CollectionName is the Mongo collection for saved searches.
	CollectionName = "saved_searches"
	// MaxPerUser is how many saved searches one account may keep.
	MaxPerUser = 20
	// MaxNameLength caps the user-facing label.
	MaxNameLength = 80
	// MaxQueryLength caps the keyword string, matching job search filters.
	MaxQueryLength = 200
	// MaxFilterLength caps a single filter string.
	MaxFilterLength = 200
	// DefaultName is used when the client omits a label.
	DefaultName = "Saved search"
	// DefaultAlertBatch is how many due searches ListDue returns when limit is 0.
	DefaultAlertBatch = 100
	// MaxAlertBatch caps ListDue.
	MaxAlertBatch = 500
	// DailyInterval is how long after the last alert a daily search is due again.
	DailyInterval = 24 * time.Hour
	// WeeklyInterval is how long after the last alert a weekly search is due again.
	WeeklyInterval = 7 * 24 * time.Hour
)

// AlertFrequency is how often a saved search should produce an email alert.
type AlertFrequency string

const (
	AlertOff    AlertFrequency = "off"
	AlertDaily  AlertFrequency = "daily"
	AlertWeekly AlertFrequency = "weekly"
)

// Filters are the job-search constraints stored with a saved search.
// Field names match /v1/search/jobs so the frontend can round-trip them.
type Filters struct {
	Location   string `json:"location,omitempty" bson:"location,omitempty"`
	Workplace  string `json:"workplace,omitempty" bson:"workplace,omitempty"`
	Employment string `json:"employment,omitempty" bson:"employment,omitempty"`
	Seniority  string `json:"seniority,omitempty" bson:"seniority,omitempty"`
	Company    string `json:"company,omitempty" bson:"company,omitempty"`
	SalaryMin  int    `json:"salaryMin,omitempty" bson:"salaryMin,omitempty"`
	SalaryMax  int    `json:"salaryMax,omitempty" bson:"salaryMax,omitempty"`
	Currency   string `json:"currency,omitempty" bson:"currency,omitempty"`
	PostedDays int    `json:"postedDays,omitempty" bson:"postedDays,omitempty"`
	Remote     bool   `json:"remote,omitempty" bson:"remote,omitempty"`
	SortBy     string `json:"sort,omitempty" bson:"sort,omitempty"`
	Source     string `json:"source,omitempty" bson:"source,omitempty"`
}

// SavedSearch is one user's stored query, filters, and alert schedule.
type SavedSearch struct {
	ID             string         `json:"id" bson:"_id"`
	UserID         string         `json:"userId" bson:"userId"`
	Name           string         `json:"name" bson:"name"`
	Query          string         `json:"query" bson:"query"`
	Filters        Filters        `json:"filters" bson:"filters"`
	AlertFrequency AlertFrequency `json:"alertFrequency" bson:"alertFrequency"`
	LastAlertedAt  time.Time      `json:"lastAlertedAt,omitempty" bson:"lastAlertedAt,omitempty"`
	CreatedAt      time.Time      `json:"createdAt" bson:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt" bson:"updatedAt"`
}

// Input is the body for creating a saved search.
type Input struct {
	Name           string         `json:"name"`
	Query          string         `json:"query"`
	Filters        Filters        `json:"filters"`
	AlertFrequency AlertFrequency `json:"alertFrequency"`
}

// Patch is a partial update. Nil fields are left unchanged.
type Patch struct {
	Name           *string         `json:"name"`
	Query          *string         `json:"query"`
	Filters        *Filters        `json:"filters"`
	AlertFrequency *AlertFrequency `json:"alertFrequency"`
}

// AlertDue reports whether this search should be considered for an alert at now.
func (s SavedSearch) AlertDue(now time.Time) bool {
	switch s.AlertFrequency {
	case AlertDaily:
		return !s.lastAlerted().After(now.Add(-DailyInterval))
	case AlertWeekly:
		return !s.lastAlerted().After(now.Add(-WeeklyInterval))
	case AlertOff, "":
		return false
	default:
		return false
	}
}

func (s SavedSearch) lastAlerted() time.Time {
	return s.LastAlertedAt.UTC()
}

func clampAlertLimit(limit int) int {
	if limit <= 0 {
		return DefaultAlertBatch
	}
	if limit > MaxAlertBatch {
		return MaxAlertBatch
	}
	return limit
}

func normalizeFrequency(value AlertFrequency) AlertFrequency {
	switch AlertFrequency(strings.ToLower(strings.TrimSpace(string(value)))) {
	case AlertDaily:
		return AlertDaily
	case AlertWeekly:
		return AlertWeekly
	case AlertOff, "":
		return AlertOff
	default:
		return AlertFrequency(strings.ToLower(strings.TrimSpace(string(value))))
	}
}

func (f AlertFrequency) valid() bool {
	switch f {
	case AlertOff, AlertDaily, AlertWeekly:
		return true
	default:
		return false
	}
}

func normalizeFilters(in Filters) Filters {
	return Filters{
		Location:   truncateRunes(strings.TrimSpace(in.Location), MaxFilterLength),
		Workplace:  strings.TrimSpace(in.Workplace),
		Employment: strings.TrimSpace(in.Employment),
		Seniority:  strings.TrimSpace(in.Seniority),
		Company:    truncateRunes(strings.TrimSpace(in.Company), MaxFilterLength),
		SalaryMin:  in.SalaryMin,
		SalaryMax:  in.SalaryMax,
		Currency:   strings.TrimSpace(in.Currency),
		PostedDays: in.PostedDays,
		Remote:     in.Remote,
		SortBy:     strings.ToLower(strings.TrimSpace(in.SortBy)),
		Source:     strings.ToLower(strings.TrimSpace(in.Source)),
	}
}

func (f Filters) valid() error {
	if f.SalaryMin < 0 || f.SalaryMax < 0 {
		return ErrInvalidInput
	}
	if f.SalaryMax > 0 && f.SalaryMin > f.SalaryMax {
		return ErrInvalidInput
	}
	if f.PostedDays < 0 {
		return ErrInvalidInput
	}
	switch f.SortBy {
	case "", "newest", "relevance":
	default:
		return ErrInvalidInput
	}
	switch strings.ToLower(f.Source) {
	case "", "hidden":
	default:
		return ErrInvalidInput
	}
	return nil
}

func normalizeName(name, query string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		query = strings.TrimSpace(query)
		if query != "" {
			return truncateRunes(query, MaxNameLength)
		}
		return DefaultName
	}
	return truncateRunes(name, MaxNameLength)
}

func truncateRunes(value string, max int) string {
	if utf8.RuneCountInString(value) <= max {
		return value
	}
	return string([]rune(value)[:max])
}
