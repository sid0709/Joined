package jobs

import (
	"context"
	"encoding/json"
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

// CrawlerIngest marks temp jobs the crawler extension sent straight to temp_jobs
// (the ingestedVia field).
const CrawlerIngest = "crawler"

const (
	// MaxCrawlerBatch is the most jobs one ingest request may carry.
	MaxCrawlerBatch = 50
	// DefaultCrawlerDuplicateWindowDays applies when a job sends no window.
	DefaultCrawlerDuplicateWindowDays = 30
	maxCrawlerDuplicateWindowDays     = 365
	// crawlerFallbackSource names the board when the crawler does not.
	crawlerFallbackSource = "crawler"
	applyLinkKeyField     = "applyLinkKey"
	ingestedViaField      = "ingestedVia"
)

// CrawledCompany is the employer a board showed on a job. Name and logo are the
// fields every board is expected to have. Anything else the board happened to
// show (tags, employee count, ...) is kept in Metadata, because boards do not
// share that set.
type CrawledCompany struct {
	Name     string         `json:"name"`
	Logo     string         `json:"logo"`
	Tags     []string       `json:"tags"`
	Metadata map[string]any `json:"-"`
}

// UnmarshalJSON keeps name, logo, and tags, and keeps every other company field
// for metadata. A board that omits tags still decodes.
func (c *CrawledCompany) UnmarshalJSON(data []byte) error {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	if len(raw) == 0 {
		return nil
	}
	if value, ok := raw["name"]; ok {
		if err := json.Unmarshal(value, &c.Name); err != nil {
			return err
		}
	}
	if value, ok := raw["logo"]; ok {
		if err := json.Unmarshal(value, &c.Logo); err != nil {
			return err
		}
	}
	if value, ok := raw["tags"]; ok {
		var tags []string
		if err := json.Unmarshal(value, &tags); err == nil {
			c.Tags = tags
		}
	}
	meta := make(map[string]any, len(raw))
	for key, value := range raw {
		if key == "name" || key == "logo" || key == crawlerMetadataKey {
			continue
		}
		var decoded any
		if err := json.Unmarshal(value, &decoded); err != nil {
			return err
		}
		meta[key] = decoded
	}
	if nested, ok := raw[crawlerMetadataKey]; ok {
		var decoded any
		if err := json.Unmarshal(nested, &decoded); err != nil {
			return err
		}
		for key, value := range mapValue(decoded) {
			if _, exists := meta[key]; !exists {
				meta[key] = value
			}
		}
	}
	c.Metadata = meta
	return nil
}

// CrawlerBatch is one ingest request: the crawler's scrape source and its jobs.
type CrawlerBatch struct {
	CreatedBy string       `json:"createdBy"`
	Jobs      []CrawledJob `json:"jobs"`
}

// CrawlerJobResult is one job's outcome, in the order and shape the crawler's save
// queue reads. A statusCode of 500 or more tells the crawler to retry that job.
type CrawlerJobResult struct {
	Index      int    `json:"index"`
	Success    bool   `json:"success"`
	Created    bool   `json:"created"`
	Duplicate  bool   `json:"duplicate"`
	TempJobID  string `json:"tempJobId,omitempty"`
	Reason     string `json:"reason,omitempty"`
	Error      string `json:"error,omitempty"`
	StatusCode int    `json:"statusCode"`
}

type CrawlerIngestSummary struct {
	Created    int `json:"created"`
	Duplicates int `json:"duplicates"`
	Failed     int `json:"failed"`
}

type CrawlerIngestResult struct {
	Results []CrawlerJobResult   `json:"results"`
	Summary CrawlerIngestSummary `json:"summary"`
}

// ParseCrawlerBatch decodes an ingest request and checks its size. Each job is
// checked on its own during ingest, so one bad job does not reject the batch.
func ParseCrawlerBatch(body []byte) (CrawlerBatch, error) {
	var batch CrawlerBatch
	if err := json.Unmarshal(body, &batch); err != nil {
		return CrawlerBatch{}, fmt.Errorf("%w: body is not a crawler batch", ErrInvalidInput)
	}
	if len(batch.Jobs) == 0 {
		return CrawlerBatch{}, fmt.Errorf("%w: jobs is empty", ErrInvalidInput)
	}
	if len(batch.Jobs) > MaxCrawlerBatch {
		return CrawlerBatch{}, fmt.Errorf("%w: at most %d jobs per request", ErrInvalidInput, MaxCrawlerBatch)
	}
	return batch, nil
}

// crawledJobProblem names what a job is missing, or returns "" when it can be staged.
func crawledJobProblem(job CrawledJob) string {
	sanitizeCrawledJob(&job)
	switch {
	case strings.TrimSpace(job.Title) == "":
		return "title is required"
	case crawledCompanyName(job) == "":
		return "company name is required"
	case strings.TrimSpace(job.Description) == "":
		return "description is required"
	case !isHTTPURL(crawledApplyURL(job)):
		return "applyLink must be an http(s) URL"
	case crawlerJobMetadataBytes(job) > maxCrawlerJobMetadataBytes:
		return "metadata is too large"
	default:
		return ""
	}
}

func isHTTPURL(raw string) bool {
	value := strings.ToLower(strings.TrimSpace(raw))
	return strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://")
}

// crawlerDuplicateWindow clamps a job's lookback to 1–365 days, defaulting to 30.
func crawlerDuplicateWindow(days int) time.Duration {
	if days < 1 {
		days = DefaultCrawlerDuplicateWindowDays
	}
	if days > maxCrawlerDuplicateWindowDays {
		days = maxCrawlerDuplicateWindowDays
	}
	return time.Duration(days) * 24 * time.Hour
}

var postedAgoPattern = regexp.MustCompile(`(\d+)\s*(minute|min|hour|hr|day|week|month|year)s?`)

var postedAgoUnits = map[string]time.Duration{
	"minute": time.Minute,
	"min":    time.Minute,
	"hour":   time.Hour,
	"hr":     time.Hour,
	"day":    24 * time.Hour,
	"week":   7 * 24 * time.Hour,
	"month":  30 * 24 * time.Hour,
	"year":   365 * 24 * time.Hour,
}

// PostedAtFromAgo turns a board's "3 hours ago" into a time. Text it cannot
// read is left as zero so ingest never writes the crawl clock as postedAt.
func PostedAtFromAgo(text string, now time.Time) time.Time {
	parsed, _ := postedAtFromAgoText(text, now)
	return parsed
}

func postedAtFromAgoText(text string, now time.Time) (time.Time, bool) {
	value := strings.ToLower(strings.TrimSpace(text))
	if value == "" {
		return time.Time{}, false
	}
	if strings.Contains(value, "yesterday") {
		return now.Add(-24 * time.Hour), true
	}
	match := postedAgoPattern.FindStringSubmatch(value)
	if match == nil {
		return time.Time{}, false
	}
	count, err := strconv.Atoi(match[1])
	if err != nil {
		return time.Time{}, false
	}
	return now.Add(-time.Duration(count) * postedAgoUnits[match[2]]), true
}

func cleanStrings(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

var allowedPostedAtSources = map[string]struct{}{
	"estimated_publish_date": {},
	"jsonLd":                 {},
	"jsonld":                 {},
	"jsonld+ago":             {},
	"ago":                    {},
	"dom":                    {},
	"none":                   {},
}

func postedAtSourceValue(raw string) string {
	value := strings.TrimSpace(raw)
	if _, ok := allowedPostedAtSources[value]; ok {
		return value
	}
	return ""
}

func cleanedCompanyWebsite(job CrawledJob, extraMeta map[string]any) string {
	for _, raw := range []string{
		job.CompanyLink,
		stringValue(job.Company.Metadata[crawlerCompanyWebsiteKey]),
		stringValue(extraMeta[crawlerWebsiteKey]),
		stringValue(job.Metadata[crawlerWebsiteKey]),
	} {
		if clean, ok := crawlerCompanyWebsite(raw); ok {
			return clean
		}
	}
	return ""
}

func mapToBSON(meta map[string]any) bson.D {
	return sanitizeMetadataMap(meta, 1, false)
}

func crawledDetails(details map[string]string) bson.D {
	doc := bson.D{}
	for key, value := range details {
		key = strings.TrimSpace(key)
		if key == "" || strings.ContainsAny(key, ".$") {
			continue
		}
		if text := strings.TrimSpace(value); text != "" {
			doc = append(doc, bson.E{Key: key, Value: text})
		}
	}
	return doc
}

// crawledTempDocument is the temp_jobs row for a crawled job, in the fields the
// analyzer reads (see tempListing) plus free-form extra metadata.
func crawledTempDocument(id bson.ObjectID, job CrawledJob, createdBy string, now time.Time) bson.D {
	source := strings.TrimSpace(job.Source)
	if source == "" {
		source = crawlerFallbackSource
	}
	foldCompanyMetadata(&job)
	sanitizeCrawledJob(&job)
	apply := crawledApplyURL(job)
	extraMeta := map[string]any{}
	for key, value := range job.Metadata {
		if key == crawlerCrawledAtKey || key == crawlerPostedAtSourceKey || isFoldedCompanyExtraKey(key) {
			continue
		}
		extraMeta[key] = value
	}
	metadata := bson.D{
		{Key: crawlerDetailsKey, Value: crawledDetails(job.Details)},
		{Key: crawlerLogoKey, Value: strings.TrimSpace(job.Company.Logo)},
		{Key: "companyTags", Value: cleanStrings(job.Company.Tags)},
		{Key: "tags", Value: cleanStrings(job.Tags)},
		{Key: "skills", Value: cleanStrings(job.Skills)},
		{Key: crawlerPostedAgoKey, Value: strings.TrimSpace(job.PostedAgo)},
	}
	if source := postedAtSourceValue(
		firstString(job.Metadata[crawlerPostedAtSourceKey], extraMeta[crawlerPostedAtSourceKey]),
	); source != "" {
		metadata = append(metadata, bson.E{Key: crawlerPostedAtSourceKey, Value: source})
	}
	delete(extraMeta, crawlerPostedAtSourceKey)
	metadata = append(metadata, bson.E{Key: "applicants", Value: bson.D{
		{Key: "count", Value: job.Applicants.Count},
		{Key: "text", Value: strings.TrimSpace(job.Applicants.Text)},
	}})
	if crawledAt := job.CrawledAt; crawledAt != "" {
		metadata = append(metadata, bson.E{Key: crawlerCrawledAtKey, Value: crawledAt})
	}
	website := cleanedCompanyWebsite(job, extraMeta)
	if website != "" {
		metadata = append(metadata, bson.E{Key: crawlerWebsiteKey, Value: website})
	}
	delete(extraMeta, crawlerWebsiteKey)
	if company := crawledCompanyMetadata(job.Company); len(company) > 0 {
		metadata = append(metadata, bson.E{Key: crawlerCompanyKey, Value: company})
	}
	if extra := mapToBSON(extraMeta); len(extra) > 0 {
		metadata = append(metadata, bson.E{Key: crawlerExtraKey, Value: extra})
	}
	doc := bson.D{
		{Key: "_id", Value: id},
		{Key: "title", Value: strings.TrimSpace(job.Title)},
		{Key: "companyName", Value: crawledCompanyName(job)},
		{Key: "companyLink", Value: website},
		{Key: "description", Value: strings.TrimSpace(job.Description)},
		{Key: "applyLink", Value: apply},
		{Key: applyLinkKeyField, Value: CanonicalApplyURL(apply)},
		{Key: "createdAt", Value: now.UTC()},
		{Key: "createdBy", Value: createdBy},
		{Key: "source", Value: source},
		{Key: ingestedViaField, Value: CrawlerIngest},
		{Key: crawlerMetadataKey, Value: metadata},
	}
	if posted := parseCrawledPostedAt(job, now); !posted.IsZero() {
		doc = append(doc, bson.E{Key: "postedAt", Value: posted})
	}
	return doc
}

// ensureCrawlerIndexes indexes temp_jobs for the duplicate check. Creating an
// existing index is a no-op.
func (s *Store) ensureCrawlerIndexes(ctx context.Context) error {
	_, err := s.dest().Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: applyLinkKeyField, Value: 1}, {Key: "createdAt", Value: -1}},
		Options: options.Index().SetName("crawler_apply_link_key"),
	})
	if err != nil && !indexAlreadyExists(err) {
		return fmt.Errorf("ensure crawler index: %w", err)
	}
	return nil
}

// findRecentTempJob returns the temp job with the same canonical apply link created
// after since, or nil.
func (s *Store) findRecentTempJob(ctx context.Context, key string, since time.Time) (*struct {
	ID        bson.ObjectID `bson:"_id"`
	CreatedAt time.Time     `bson:"createdAt"`
}, error) {
	var found struct {
		ID        bson.ObjectID `bson:"_id"`
		CreatedAt time.Time     `bson:"createdAt"`
	}
	err := s.dest().FindOne(ctx,
		bson.D{
			{Key: applyLinkKeyField, Value: key},
			{Key: "createdAt", Value: bson.D{{Key: "$gte", Value: since.UTC()}}},
		},
		options.FindOne().SetProjection(bson.D{{Key: "_id", Value: 1}, {Key: "createdAt", Value: 1}}),
	).Decode(&found)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &found, nil
}

func (s *Store) ingestCrawledJob(ctx context.Context, index int, job CrawledJob, createdBy string, now time.Time) CrawlerJobResult {
	result := CrawlerJobResult{Index: index}
	sanitizeCrawledJob(&job)
	if problem := crawledJobProblem(job); problem != "" {
		result.Error = problem
		result.StatusCode = 400
		return result
	}
	if err := s.stageCrawledCompany(ctx, job, now); err != nil {
		result.Error = "could not save the company"
		result.StatusCode = 500
		return result
	}
	key := CanonicalApplyURL(crawledApplyURL(job))
	existing, err := s.findRecentTempJob(ctx, key, now.Add(-crawlerDuplicateWindow(job.DuplicateWindowDays)))
	if err != nil {
		result.Error = "could not check for duplicates"
		result.StatusCode = 500
		return result
	}
	if existing != nil {
		result.Success = true
		result.Duplicate = true
		result.TempJobID = existing.ID.Hex()
		result.Reason = fmt.Sprintf("Already in temp jobs since %s", existing.CreatedAt.UTC().Format("Jan 2, 2006"))
		result.StatusCode = 200
		return result
	}
	id := bson.NewObjectID()
	if _, err := s.dest().InsertOne(ctx, crawledTempDocument(id, job, createdBy, now)); err != nil {
		result.Error = "could not save the job"
		result.StatusCode = 500
		return result
	}
	result.Success = true
	result.Created = true
	result.TempJobID = id.Hex()
	result.StatusCode = 201
	return result
}

// IngestCrawledJobs stages each crawled job in temp_jobs for AI analysis, skipping
// one whose apply link is already there within the job's duplicate window. When
// the employer is not already in companies or temp_companies, and the board gave
// a name, website, and logo, it stages that company in temp_companies.
func (s *Store) IngestCrawledJobs(ctx context.Context, batch CrawlerBatch, now time.Time) (CrawlerIngestResult, error) {
	if err := s.ensureCrawlerIndexes(ctx); err != nil {
		return CrawlerIngestResult{}, err
	}
	if err := ensureCompanyIndexes(ctx, s.stagedCompanies()); err != nil && !indexAlreadyExists(err) {
		return CrawlerIngestResult{}, err
	}

	result := CrawlerIngestResult{Results: make([]CrawlerJobResult, 0, len(batch.Jobs))}
	for index, job := range batch.Jobs {
		createdBy := strings.TrimSpace(job.CreatedBy)
		if createdBy == "" {
			createdBy = strings.TrimSpace(batch.CreatedBy)
		}
		outcome := s.ingestCrawledJob(ctx, index, job, createdBy, now)
		switch {
		case outcome.Created:
			result.Summary.Created++
		case outcome.Duplicate:
			result.Summary.Duplicates++
		default:
			result.Summary.Failed++
		}
		result.Results = append(result.Results, outcome)
	}
	return result, nil
}
