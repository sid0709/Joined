package jobs

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	defaultPageSize     = 50
	maxPageSize         = 100
	maxRegexFilterChars = 200
	// SearchSourceHidden is the /v1/search/jobs?source= query value for scouted jobs.
	SearchSourceHidden = "hidden"
)

var ErrCursorNotSupportedForRelevance = errors.New("cursor-based paging not supported with relevance sort")

type SearchQuery struct {
	Keyword    string
	Location   string
	Workplace  string
	Employment string
	Seniority  string
	Company    string
	SalaryMin  int
	SalaryMax  int
	Currency   string
	PostedDays int
	Remote     bool
	SortBy     string
	Limit      int
	Cursor     string
	// Source is an optional listing origin filter. "hidden" keeps scouted jobs only.
	Source string
}

type SearchResults struct {
	Jobs       []catalogJob `json:"jobs"`
	Total      int64        `json:"total"`
	NextCursor string       `json:"nextCursor,omitempty"`
	HasMore    bool         `json:"hasMore"`
}

func (s *Store) SearchJobs(ctx context.Context, query SearchQuery, now time.Time) (SearchResults, error) {
	if query.Cursor != "" && query.SortBy == "relevance" && query.Keyword != "" {
		return SearchResults{}, ErrCursorNotSupportedForRelevance
	}

	filter := s.buildSearchFilter(query, now)

	total, err := s.structured().CountDocuments(ctx, filter)
	if err != nil {
		return SearchResults{}, fmt.Errorf("count documents: %w", err)
	}

	limit := clampSearchLimit(query.Limit)

	opts := options.Find().SetLimit(int64(limit + 1))

	sort, err := s.buildSort(query, filter)
	if err != nil {
		return SearchResults{}, fmt.Errorf("build sort: %w", err)
	}
	opts.SetSort(sort)

	if query.Keyword != "" {
		opts.SetProjection(bson.D{{Key: "score", Value: bson.D{{Key: "$meta", Value: "textScore"}}}})
	}

	if query.Cursor != "" {
		cursorFilter, err := decodeCursor(query.Cursor, query.SortBy)
		if err != nil {
			return SearchResults{}, fmt.Errorf("decode cursor: %w", err)
		}
		filter = bson.D{{Key: "$and", Value: bson.A{filter, cursorFilter}}}
	}

	cursor, err := s.structured().Find(ctx, filter, opts)
	if err != nil {
		return SearchResults{}, fmt.Errorf("find: %w", err)
	}
	defer cursor.Close(ctx)

	var docs []storedSearchJob
	if err := cursor.All(ctx, &docs); err != nil {
		return SearchResults{}, fmt.Errorf("decode results: %w", err)
	}

	hasMore := len(docs) > limit
	if hasMore {
		docs = docs[:limit]
	}

	jobs := make([]catalogJob, 0, len(docs))
	for _, doc := range docs {
		jobs = append(jobs, CatalogJob(doc.view(now)))
	}

	jobs, err = s.enrichCompanies(ctx, jobs)
	if err != nil {
		return SearchResults{}, fmt.Errorf("enrich companies: %w", err)
	}

	var nextCursor string
	if hasMore && len(docs) > 0 {
		nextCursor = encodeCursor(docs[len(docs)-1], query.SortBy)
	}

	return SearchResults{
		Jobs:       jobs,
		Total:      total,
		NextCursor: nextCursor,
		HasMore:    hasMore,
	}, nil
}

// HasCriteria reports whether the query should use the paged search path
// instead of the unfiltered catalog. source=hidden counts, even alone.
func (q SearchQuery) HasCriteria() bool {
	return q.Keyword != "" || q.Location != "" || q.Company != "" ||
		q.Workplace != "" || q.Employment != "" || q.Seniority != "" ||
		q.SalaryMin != 0 || q.SalaryMax != 0 || q.PostedDays != 0 ||
		q.Remote || q.Cursor != "" || q.Limit != 0 || q.SortBy != "" ||
		q.hiddenOnly()
}

func (q SearchQuery) hiddenOnly() bool {
	return strings.EqualFold(strings.TrimSpace(q.Source), SearchSourceHidden)
}

func clampSearchLimit(limit int) int {
	if limit <= 0 {
		return defaultPageSize
	}
	if limit > maxPageSize {
		return maxPageSize
	}
	return limit
}

// isHiddenJob reports whether a search row is a scouted listing. Published
// scout jobs store job.source as "scouted" (PublishScouted) or "scoutwell"
// (analysis path) and document source as ScoutedSource.
func isHiddenJob(jobSource, listingSource string) bool {
	return jobSource == scoutedJobType || jobSource == ScoutedSource || listingSource == ScoutedSource
}

// listingMatchesSearch is the candidate-search visibility contract. Pending,
// draft, and removed rows never match. source=hidden keeps only scouted jobs.
func listingMatchesSearch(listingStatus, jobSource, listingSource string, query SearchQuery) bool {
	if !ListingPublic(listingStatus) {
		return false
	}
	if query.hiddenOnly() && !isHiddenJob(jobSource, listingSource) {
		return false
	}
	return true
}

func hiddenSourceFilter() bson.D {
	return bson.D{{Key: "$or", Value: bson.A{
		bson.D{{Key: "job.source", Value: scoutedJobType}},
		bson.D{{Key: "job.source", Value: ScoutedSource}},
		bson.D{{Key: "source", Value: ScoutedSource}},
	}}}
}

func (s *Store) buildSearchFilter(query SearchQuery, now time.Time) bson.D {
	filter := publicListingFilter()
	conditions := []bson.D{filter}

	if query.hiddenOnly() {
		conditions = append(conditions, hiddenSourceFilter())
	}
	if ids := DisabledImportSources(); len(ids) > 0 {
		conditions = append(conditions, bson.D{{Key: "job.source", Value: bson.D{{Key: "$nin", Value: ids}}}})
	}

	if query.Keyword != "" {
		conditions = append(conditions, bson.D{{Key: "$text", Value: bson.D{{Key: "$search", Value: query.Keyword}}}})
	}

	if query.Location != "" {
		location := truncateString(query.Location, maxRegexFilterChars)
		escapedLocation := regexp.QuoteMeta(location)
		conditions = append(conditions, bson.D{{Key: "job.location", Value: bson.D{{Key: "$regex", Value: escapedLocation}, {Key: "$options", Value: "i"}}}})
	}

	if query.Workplace != "" {
		conditions = append(conditions, bson.D{{Key: "job.workplace", Value: query.Workplace}})
	}

	if query.Remote {
		conditions = append(conditions, bson.D{{Key: "job.workplace", Value: workplaceRemote}})
	}

	if query.Employment != "" {
		conditions = append(conditions, bson.D{{Key: "job.employment", Value: query.Employment}})
	}

	if query.Seniority != "" {
		conditions = append(conditions, bson.D{{Key: "job.seniority", Value: query.Seniority}})
	}

	if query.Company != "" {
		company := truncateString(query.Company, maxRegexFilterChars)
		escapedCompany := regexp.QuoteMeta(company)
		conditions = append(conditions, bson.D{{Key: "job.company", Value: bson.D{{Key: "$regex", Value: escapedCompany}, {Key: "$options", Value: "i"}}}})
	}

	if query.SalaryMin > 0 || query.SalaryMax > 0 {
		salaryConditions := bson.A{}
		if query.SalaryMin > 0 {
			salaryConditions = append(salaryConditions, bson.D{{Key: "job.pay.max", Value: bson.D{{Key: "$gte", Value: query.SalaryMin}}}})
		}
		if query.SalaryMax > 0 {
			salaryConditions = append(salaryConditions, bson.D{{Key: "job.pay.min", Value: bson.D{{Key: "$lte", Value: query.SalaryMax}}}})
		}
		if query.Currency != "" {
			salaryConditions = append(salaryConditions, bson.D{{Key: "job.pay.currency", Value: query.Currency}})
		}
		if len(salaryConditions) > 0 {
			conditions = append(conditions, bson.D{{Key: "$and", Value: salaryConditions}})
		}
	}

	if query.PostedDays > 0 {
		cutoff := now.Add(-time.Duration(query.PostedDays) * 24 * time.Hour)
		conditions = append(conditions, bson.D{{Key: "postedAt", Value: bson.D{{Key: "$gte", Value: cutoff}}}})
	}

	if len(conditions) == 1 {
		return conditions[0]
	}
	return bson.D{{Key: "$and", Value: conditions}}
}

func (s *Store) buildSort(query SearchQuery, filter bson.D) (bson.D, error) {
	switch query.SortBy {
	case "relevance":
		if query.Keyword == "" {
			return bson.D{{Key: "analyzedAt", Value: -1}, {Key: "_id", Value: -1}}, nil
		}
		return bson.D{{Key: "score", Value: bson.D{{Key: "$meta", Value: "textScore"}}}, {Key: "_id", Value: -1}}, nil
	case "newest", "":
		return bson.D{{Key: "analyzedAt", Value: -1}, {Key: "_id", Value: -1}}, nil
	default:
		return nil, fmt.Errorf("invalid sort: %s", query.SortBy)
	}
}

func encodeCursor(doc storedSearchJob, sortBy string) string {
	switch sortBy {
	case "relevance":
		return fmt.Sprintf("%s:%d", doc.ID.Hex(), doc.AnalyzedAt.Unix())
	default:
		return fmt.Sprintf("%s:%d", doc.ID.Hex(), doc.AnalyzedAt.Unix())
	}
}

func decodeCursor(cursor, sortBy string) (bson.D, error) {
	parts := strings.SplitN(cursor, ":", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid cursor format")
	}

	id, err := bson.ObjectIDFromHex(parts[0])
	if err != nil {
		return nil, fmt.Errorf("invalid cursor id: %w", err)
	}

	timestamp, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid cursor timestamp: %w", err)
	}

	analyzedAt := time.Unix(timestamp, 0)

	switch sortBy {
	case "relevance", "newest", "":
		return bson.D{{Key: "$or", Value: bson.A{
			bson.D{{Key: "analyzedAt", Value: bson.D{{Key: "$lt", Value: analyzedAt}}}},
			bson.D{{Key: "$and", Value: bson.A{
				bson.D{{Key: "analyzedAt", Value: analyzedAt}},
				bson.D{{Key: "_id", Value: bson.D{{Key: "$lt", Value: id}}}},
			}}},
		}}}, nil
	default:
		return nil, fmt.Errorf("invalid sort for cursor: %s", sortBy)
	}
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen]
}

func (s *Store) EnsureSearchIndexes(ctx context.Context) error {
	coll := s.structured()

	indexes := coll.Indexes()

	textIndex := mongo.IndexModel{
		Keys: bson.D{
			{Key: "job.title", Value: "text"},
			{Key: "job.company", Value: "text"},
			{Key: "job.summary", Value: "text"},
			{Key: "job.skills", Value: "text"},
			{Key: "job.description", Value: "text"},
		},
		Options: options.Index().
			SetName("search_text").
			SetWeights(bson.D{
				{Key: "job.title", Value: 10},
				{Key: "job.company", Value: 8},
				{Key: "job.skills", Value: 5},
				{Key: "job.summary", Value: 3},
				{Key: "job.description", Value: 1},
			}),
	}

	_, err := indexes.CreateOne(ctx, textIndex)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) || strings.Contains(err.Error(), "already exists") {
			return nil
		}
		return fmt.Errorf("create text index: %w", err)
	}

	return nil
}

func (s *Store) EnsureIndexes(ctx context.Context) error {
	return nil
}
