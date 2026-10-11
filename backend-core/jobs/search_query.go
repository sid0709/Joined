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
	// SearchSortNewest orders by posting date, newest first. It is what a visitor sees.
	SearchSortNewest = "newest"
	// searchListAll is the every-job list; blank means the same.
	searchListAll = "all"
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
	Page       int
	Cursor     string
	Visa       bool
	// Source is an optional listing origin filter. "hidden" keeps scouted jobs only.
	// A comma-separated list matches any of those job.source values.
	Source string
	// List is "recommended" for strong fits only (ranked search); blank is every job.
	List string
	// Region keeps jobs hiring in these markets ("us,ca"); ranked search only.
	Region string
}

type SearchResults struct {
	Jobs       []catalogJob `json:"jobs"`
	Total      int64        `json:"total"`
	NextCursor string       `json:"nextCursor,omitempty"`
	HasMore    bool         `json:"hasMore"`
}

// keywordMatch is how a typed keyword filters: Mongo's text index, or a
// case-insensitive regex for collections without one.
type keywordMatch int

const (
	keywordText keywordMatch = iota
	keywordRegex
)

const (
	// mongoIndexNotFound is the server code for a $text query without a text index.
	mongoIndexNotFound = 27
	maxKeywordTerms    = 8
	minKeywordTermLen  = 2
)

// keywordRegexFields are the fields a keyword matches when there is no text index.
var keywordRegexFields = []string{"job.title", "job.company", "job.skills"}

func (s *Store) SearchJobs(ctx context.Context, query SearchQuery, now time.Time) (SearchResults, error) {
	if query.Cursor != "" && query.SortBy == "relevance" && query.Keyword != "" {
		return SearchResults{}, ErrCursorNotSupportedForRelevance
	}
	results, err := s.searchJobs(ctx, query, now, keywordText)
	if query.Keyword != "" && isTextIndexMissing(err) {
		// Without a text index a keyword search still answers, newest first.
		return s.searchJobs(ctx, query, now, keywordRegex)
	}
	return results, err
}

func isTextIndexMissing(err error) bool {
	var serverErr mongo.ServerError
	return errors.As(err, &serverErr) && serverErr.HasErrorCode(mongoIndexNotFound)
}

func (s *Store) searchJobs(ctx context.Context, query SearchQuery, now time.Time, match keywordMatch) (SearchResults, error) {
	filter := s.searchFilter(query, now, match)

	total, err := s.structured().CountDocuments(ctx, filter)
	if err != nil {
		return SearchResults{}, fmt.Errorf("count documents: %w", err)
	}

	limit := clampSearchLimit(query.Limit)

	opts := options.Find().SetLimit(int64(limit + 1))

	sort, err := searchSort(query, match)
	if err != nil {
		return SearchResults{}, fmt.Errorf("build sort: %w", err)
	}
	opts.SetSort(sort)

	if query.Cursor == "" && query.Page > 1 {
		page := query.Page
		if page > maxSearchPage {
			page = maxSearchPage
		}
		opts.SetSkip(int64(page-1) * int64(limit))
	}

	if query.Keyword != "" && match == keywordText {
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
		q.Visa || q.Page > 1 || q.hiddenOnly()
}

// GuestView reports whether a visitor may run this search: the first page of
// the newest jobs, with nothing typed or filtered. Anything else needs an account.
func (q SearchQuery) GuestView() bool {
	if q.SortBy != "" && q.SortBy != SearchSortNewest {
		return false
	}
	if q.List != "" && q.List != searchListAll {
		return false
	}
	paging := q
	paging.SortBy, paging.Limit, paging.List, paging.Currency = "", 0, "", ""
	return paging == SearchQuery{}
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
	return s.searchFilter(query, now, keywordText)
}

func (s *Store) searchFilter(query SearchQuery, now time.Time, match keywordMatch) bson.D {
	filter := publicListingFilter()
	conditions := []bson.D{filter}

	if query.hiddenOnly() {
		conditions = append(conditions, hiddenSourceFilter())
	}

	if query.Keyword != "" {
		conditions = append(conditions, keywordFilter(query.Keyword, match))
	}

	if query.Location != "" {
		location := truncateString(query.Location, maxRegexFilterChars)
		escapedLocation := regexp.QuoteMeta(location)
		conditions = append(conditions, bson.D{{Key: "job.location", Value: bson.D{{Key: "$regex", Value: escapedLocation}, {Key: "$options", Value: "i"}}}})
	}

	if clause, ok := matchOneOrMany("job.workplace", query.Workplace); ok {
		conditions = append(conditions, clause)
	}

	if query.Remote {
		conditions = append(conditions, bson.D{{Key: "job.workplace", Value: workplaceRemote}})
	}

	if clause, ok := matchOneOrMany("job.employment", query.Employment); ok {
		conditions = append(conditions, clause)
	}

	if clause, ok := matchOneOrMany("job.seniority", query.Seniority); ok {
		conditions = append(conditions, clause)
	}

	if !query.hiddenOnly() {
		if clause, ok := matchOneOrMany("job.source", query.Source); ok {
			conditions = append(conditions, clause)
		}
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

	if query.Visa {
		conditions = append(conditions, bson.D{{Key: "job.visa", Value: true}})
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

// keywordFilter matches a typed keyword. Without a text score to rank by, the
// regex form needs every term in the job's title, company, or skills, so a
// newest-first list stays on topic.
func keywordFilter(keyword string, match keywordMatch) bson.D {
	if match == keywordText {
		return bson.D{{Key: "$text", Value: bson.D{{Key: "$search", Value: keyword}}}}
	}
	terms := keywordTerms(keyword)
	if len(terms) == 0 {
		terms = []string{truncateString(strings.TrimSpace(keyword), maxRegexFilterChars)}
	}
	each := bson.A{}
	for _, term := range terms {
		pattern := bson.D{{Key: "$regex", Value: regexp.QuoteMeta(term)}, {Key: "$options", Value: "i"}}
		anyField := bson.A{}
		for _, field := range keywordRegexFields {
			anyField = append(anyField, bson.D{{Key: field, Value: pattern}})
		}
		each = append(each, bson.D{{Key: "$or", Value: anyField}})
	}
	return bson.D{{Key: "$and", Value: each}}
}

func keywordTerms(keyword string) []string {
	seen := map[string]bool{}
	terms := make([]string, 0, maxKeywordTerms)
	for _, term := range strings.Fields(strings.ToLower(truncateString(keyword, maxRegexFilterChars))) {
		if len(term) < minKeywordTermLen || seen[term] {
			continue
		}
		seen[term] = true
		terms = append(terms, term)
		if len(terms) == maxKeywordTerms {
			break
		}
	}
	return terms
}

func (s *Store) buildSort(query SearchQuery, filter bson.D) (bson.D, error) {
	return searchSort(query, keywordText)
}

func searchSort(query SearchQuery, match keywordMatch) (bson.D, error) {
	switch query.SortBy {
	case "relevance":
		if query.Keyword == "" || match == keywordRegex {
			return bson.D{{Key: "analyzedAt", Value: -1}, {Key: "_id", Value: -1}}, nil
		}
		return bson.D{{Key: "score", Value: bson.D{{Key: "$meta", Value: "textScore"}}}, {Key: "_id", Value: -1}}, nil
	case "newest", "":
		return bson.D{{Key: "analyzedAt", Value: -1}, {Key: "_id", Value: -1}}, nil
	case "pay":
		return bson.D{{Key: "job.pay.max", Value: -1}, {Key: "_id", Value: -1}}, nil
	case "applicants":
		return bson.D{{Key: "job.applicants", Value: 1}, {Key: "_id", Value: -1}}, nil
	default:
		return nil, fmt.Errorf("invalid sort: %s", query.SortBy)
	}
}

const maxSearchPage = 200

func splitList(raw string) []string {
	parts := strings.Split(raw, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			values = append(values, part)
		}
	}
	return values
}

func matchOneOrMany(field, raw string) (bson.D, bool) {
	values := splitList(raw)
	if len(values) == 0 {
		return nil, false
	}
	if len(values) == 1 {
		return bson.D{{Key: field, Value: values[0]}}, true
	}
	return bson.D{{Key: field, Value: bson.D{{Key: "$in", Value: values}}}}, true
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
	case "relevance", "newest", "pay", "applicants", "":
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
