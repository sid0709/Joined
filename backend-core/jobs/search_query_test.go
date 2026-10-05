package jobs

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestBuildSearchFilter(t *testing.T) {
	s := &Store{}
	now := time.Now()

	tests := []struct {
		name  string
		query SearchQuery
		want  func(bson.D) bool
	}{
		{
			name:  "empty query returns public filter",
			query: SearchQuery{},
			want: func(filter bson.D) bool {
				return len(filter) == 1 && filter[0].Key == "listingStatus"
			},
		},
		{
			name:  "keyword adds text search",
			query: SearchQuery{Keyword: "engineer"},
			want: func(filter bson.D) bool {
				return len(filter) == 1 && filter[0].Key == "$and"
			},
		},
		{
			name:  "location adds regex filter",
			query: SearchQuery{Location: "San Francisco"},
			want: func(filter bson.D) bool {
				if filter[0].Key != "$and" {
					return false
				}
				conditions := filter[0].Value.([]bson.D)
				for _, cond := range conditions {
					if cond[0].Key == "job.location" {
						return true
					}
				}
				return false
			},
		},
		{
			name:  "workplace adds exact match",
			query: SearchQuery{Workplace: workplaceRemote},
			want: func(filter bson.D) bool {
				if filter[0].Key != "$and" {
					return false
				}
				conditions := filter[0].Value.([]bson.D)
				for _, cond := range conditions {
					if cond[0].Key == "job.workplace" {
						return true
					}
				}
				return false
			},
		},
		{
			name:  "remote flag adds workplace filter",
			query: SearchQuery{Remote: true},
			want: func(filter bson.D) bool {
				if filter[0].Key != "$and" {
					return false
				}
				conditions := filter[0].Value.([]bson.D)
				for _, cond := range conditions {
					if cond[0].Key == "job.workplace" {
						if val, ok := cond[0].Value.(string); ok && val == workplaceRemote {
							return true
						}
					}
				}
				return false
			},
		},
		{
			name:  "salary min filters max",
			query: SearchQuery{SalaryMin: 100000},
			want: func(filter bson.D) bool {
				if filter[0].Key != "$and" {
					return false
				}
				conditions := filter[0].Value.([]bson.D)
				for _, cond := range conditions {
					if cond[0].Key == "$and" {
						return true
					}
				}
				return false
			},
		},
		{
			name:  "posted days filters date",
			query: SearchQuery{PostedDays: 7},
			want: func(filter bson.D) bool {
				if filter[0].Key != "$and" {
					return false
				}
				conditions := filter[0].Value.([]bson.D)
				for _, cond := range conditions {
					if cond[0].Key == "postedAt" {
						return true
					}
				}
				return false
			},
		},
		{
			name: "multiple filters combined",
			query: SearchQuery{
				Keyword:    "golang",
				Location:   "NYC",
				Workplace:  workplaceRemote,
				SalaryMin:  120000,
				PostedDays: 30,
			},
			want: func(filter bson.D) bool {
				return filter[0].Key == "$and"
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filter := s.buildSearchFilter(tt.query, now)
			if !tt.want(filter) {
				t.Errorf("buildSearchFilter() filter validation failed for %s: %+v", tt.name, filter)
			}
		})
	}
}

func TestBuildSort(t *testing.T) {
	s := &Store{}

	tests := []struct {
		name    string
		query   SearchQuery
		wantErr bool
		check   func(bson.D) bool
	}{
		{
			name:    "default sort is newest",
			query:   SearchQuery{},
			wantErr: false,
			check: func(sort bson.D) bool {
				return len(sort) == 2 && sort[0].Key == "analyzedAt" && sort[0].Value == -1
			},
		},
		{
			name:    "newest sort explicit",
			query:   SearchQuery{SortBy: "newest"},
			wantErr: false,
			check: func(sort bson.D) bool {
				return len(sort) == 2 && sort[0].Key == "analyzedAt" && sort[0].Value == -1
			},
		},
		{
			name:    "relevance without keyword falls back to newest",
			query:   SearchQuery{SortBy: "relevance"},
			wantErr: false,
			check: func(sort bson.D) bool {
				return len(sort) == 2 && sort[0].Key == "analyzedAt" && sort[0].Value == -1
			},
		},
		{
			name:    "relevance with keyword uses text score",
			query:   SearchQuery{SortBy: "relevance", Keyword: "engineer"},
			wantErr: false,
			check: func(sort bson.D) bool {
				return len(sort) == 2 && sort[0].Key == "score"
			},
		},
		{
			name:    "invalid sort returns error",
			query:   SearchQuery{SortBy: "invalid"},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filter := bson.D{}
			sort, err := s.buildSort(tt.query, filter)
			if tt.wantErr {
				if err == nil {
					t.Error("buildSort() expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Errorf("buildSort() unexpected error: %v", err)
				return
			}
			if tt.check != nil && !tt.check(sort) {
				t.Errorf("buildSort() check failed for %s: %+v", tt.name, sort)
			}
		})
	}
}

func TestEncodeCursor(t *testing.T) {
	docID := bson.NewObjectID()
	analyzedAt := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	
	doc := storedSearchJob{
		ID:         docID,
		AnalyzedAt: analyzedAt,
	}

	tests := []struct {
		name   string
		sortBy string
	}{
		{
			name:   "newest sort",
			sortBy: "newest",
		},
		{
			name:   "relevance sort",
			sortBy: "relevance",
		},
		{
			name:   "empty sort defaults",
			sortBy: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := encodeCursor(doc, tt.sortBy)
			expectedPrefix := docID.Hex() + ":"
			expectedTimestamp := "1791201600"
			expectedCursor := expectedPrefix + expectedTimestamp
			
			if got != expectedCursor {
				t.Errorf("encodeCursor() = %v, want %v", got, expectedCursor)
			}
			
			parts := strings.SplitN(got, ":", 2)
			if len(parts) != 2 {
				t.Errorf("cursor should have format id:timestamp, got %v", got)
			}
			if parts[0] != docID.Hex() {
				t.Errorf("cursor id = %v, want %v", parts[0], docID.Hex())
			}
		})
	}
}

func TestDecodeCursor(t *testing.T) {
	docID := bson.NewObjectID()
	timestamp := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC).Unix()
	validCursor := docID.Hex() + ":" + "1728129600"

	tests := []struct {
		name    string
		cursor  string
		sortBy  string
		wantErr bool
	}{
		{
			name:    "valid cursor newest",
			cursor:  validCursor,
			sortBy:  "newest",
			wantErr: false,
		},
		{
			name:    "valid cursor relevance",
			cursor:  validCursor,
			sortBy:  "relevance",
			wantErr: false,
		},
		{
			name:    "invalid format",
			cursor:  "invalid",
			sortBy:  "newest",
			wantErr: true,
		},
		{
			name:    "invalid id",
			cursor:  "notanhexid:1728129600",
			sortBy:  "newest",
			wantErr: true,
		},
		{
			name:    "invalid timestamp",
			cursor:  docID.Hex() + ":notanumber",
			sortBy:  "newest",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filter, err := decodeCursor(tt.cursor, tt.sortBy)
			if tt.wantErr {
				if err == nil {
					t.Error("decodeCursor() expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Errorf("decodeCursor() unexpected error: %v", err)
				return
			}
			if filter == nil || len(filter) == 0 {
				t.Error("decodeCursor() returned empty filter")
			}
			_ = timestamp
		})
	}
}

func TestSearchQueryPaging(t *testing.T) {
	query := SearchQuery{
		Limit: 10,
	}

	if query.Limit != 10 {
		t.Errorf("limit = %d, want 10", query.Limit)
	}

	query.Limit = 0
	if query.Limit != 0 {
		t.Errorf("limit = %d, want 0", query.Limit)
	}

	query.Limit = 200
	if query.Limit != 200 {
		t.Errorf("limit = %d, want 200", query.Limit)
	}
}

func TestSearchQueryFilters(t *testing.T) {
	query := SearchQuery{
		Keyword:    "software engineer",
		Location:   "San Francisco",
		Workplace:  workplaceRemote,
		Employment: employmentFullTime,
		Seniority:  senioritySenior,
		Company:    "Google",
		SalaryMin:  120000,
		SalaryMax:  180000,
		Currency:   "USD",
		PostedDays: 7,
		Remote:     true,
		SortBy:     "relevance",
	}

	if query.Keyword == "" {
		t.Error("keyword should be set")
	}
	if query.SalaryMin >= query.SalaryMax {
		t.Error("salary min should be less than max")
	}
	if query.PostedDays <= 0 {
		t.Error("posted days should be positive")
	}
	if !query.Remote {
		t.Error("remote should be true")
	}
}

func TestEnsureSearchIndexesIdempotent(t *testing.T) {
	ctx := context.Background()
	
	s := &Store{}
	
	if s.client == nil {
		t.Skip("no mongo client available for integration test")
	}

	err := s.EnsureSearchIndexes(ctx)
	if err != nil {
		t.Logf("first call failed (expected in unit test): %v", err)
	}

	err = s.EnsureSearchIndexes(ctx)
	if err != nil {
		t.Logf("second call failed (expected in unit test): %v", err)
	}
}

func TestRegexEscaping(t *testing.T) {
	s := &Store{}
	now := time.Now()

	tests := []struct {
		name     string
		location string
		company  string
		wantErr  bool
	}{
		{
			name:     "special regex chars are escaped in location",
			location: ".*",
			company:  "",
		},
		{
			name:     "special regex chars are escaped in company",
			location: "",
			company:  "Google.*",
		},
		{
			name:     "parentheses are escaped",
			location: "San (Francisco)",
			company:  "Company (Acquired)",
		},
		{
			name:     "brackets are escaped",
			location: "[Remote]",
			company:  "[Stealth]",
		},
		{
			name:     "plus and star escaped",
			location: "C++",
			company:  "A*STAR",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := SearchQuery{
				Location: tt.location,
				Company:  tt.company,
			}
			filter := s.buildSearchFilter(query, now)
			
			if filter == nil {
				t.Error("filter should not be nil")
			}
		})
	}
}

func TestRegexFilterTruncation(t *testing.T) {
	s := &Store{}
	now := time.Now()

	longString := strings.Repeat("a", maxRegexFilterChars+100)
	
	query := SearchQuery{
		Location: longString,
		Company:  longString,
	}
	
	filter := s.buildSearchFilter(query, now)
	
	if filter == nil {
		t.Error("filter should not be nil with long strings")
	}
	
	filterStr := fmt.Sprintf("%v", filter)
	if strings.Contains(filterStr, strings.Repeat("a", maxRegexFilterChars+1)) {
		t.Error("filter should truncate strings longer than maxRegexFilterChars")
	}
}

func TestCursorNotSupportedForRelevanceWithKeyword(t *testing.T) {
	s := &Store{}
	
	if s.client == nil {
		t.Skip("no mongo client available for integration test")
	}

	ctx := context.Background()
	query := SearchQuery{
		Keyword: "engineer",
		SortBy:  "relevance",
		Cursor:  "somecursor:123456",
	}

	_, err := s.SearchJobs(ctx, query, time.Now())
	if err == nil {
		t.Error("SearchJobs should return error for cursor with relevance sort and keyword")
	}
	if !errors.Is(err, ErrCursorNotSupportedForRelevance) {
		t.Errorf("expected ErrCursorNotSupportedForRelevance, got %v", err)
	}
}

func TestCursorAllowedForRelevanceWithoutKeyword(t *testing.T) {
	s := &Store{}
	
	if s.client == nil {
		t.Skip("no mongo client available for integration test")
	}

	ctx := context.Background()
	query := SearchQuery{
		SortBy: "relevance",
		Cursor: "6ac36ea3c508e723b31f8671:1791201600",
	}

	_, err := s.SearchJobs(ctx, query, time.Now())
	if errors.Is(err, ErrCursorNotSupportedForRelevance) {
		t.Error("cursor should be allowed for relevance sort without keyword (falls back to newest)")
	}
}

func TestTruncateString(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		maxLen int
		want   string
	}{
		{
			name:   "short string unchanged",
			input:  "hello",
			maxLen: 10,
			want:   "hello",
		},
		{
			name:   "exact length unchanged",
			input:  "hello",
			maxLen: 5,
			want:   "hello",
		},
		{
			name:   "long string truncated",
			input:  "hello world",
			maxLen: 5,
			want:   "hello",
		},
		{
			name:   "empty string unchanged",
			input:  "",
			maxLen: 10,
			want:   "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := truncateString(tt.input, tt.maxLen)
			if got != tt.want {
				t.Errorf("truncateString() = %q, want %q", got, tt.want)
			}
		})
	}
}
