package jobs

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"slices"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// crawlerCompanySourcePrefix marks a company the crawler staged. Source company
// ids are object ids, so this prefix cannot collide with one.
const crawlerCompanySourcePrefix = "crawler:"

// stageCrawledCompany writes the employer on a crawled job into temp_companies
// when that employer is not already published or staged. Name, website, and logo
// are required. Boards differ on everything else, so tags, headcount, and any
// other gathered field stay under metadata. A job whose board omitted the
// website or logo is still saved; its company is left unstaged.
func (s *Store) stageCrawledCompany(ctx context.Context, job CrawledJob, now time.Time) error {
	name := strings.TrimSpace(job.Company.Name)
	link := strings.TrimSpace(job.CompanyLink)
	logo := strings.TrimSpace(job.Company.Logo)
	key := companySlug(name)
	if key == "" || !isHTTPURL(link) || !isHTTPURL(logo) {
		return nil
	}
	exists, err := s.crawledCompanyExists(ctx, name, key, link)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	id, err := newPublicID()
	if err != nil {
		return err
	}
	_, err = s.stagedCompanies().InsertOne(ctx, crawledCompanyDocument(id, crawlerCompanySourcePrefix+key, job, now))
	if mongo.IsDuplicateKeyError(err) {
		return nil
	}
	if err != nil {
		slog.Error("stage crawled company", "company", name, "error", err)
		return fmt.Errorf("stage crawled company: %w", err)
	}
	return nil
}

// crawledCompanyExists reports whether this employer is already in companies or
// waiting in temp_companies. Matching does not publish a staged company.
func (s *Store) crawledCompanyExists(ctx context.Context, name, key, link string) (bool, error) {
	filter := crawledCompanyFilter(name, key, link)
	for _, coll := range []*mongo.Collection{s.companies(), s.stagedCompanies()} {
		err := coll.FindOne(ctx, filter, options.FindOne().SetProjection(bson.D{{Key: "_id", Value: 1}})).Err()
		if err == nil {
			return true, nil
		}
		if !errors.Is(err, mongo.ErrNoDocuments) {
			return false, fmt.Errorf("look up company: %w", err)
		}
	}
	return false, nil
}

func crawledCompanyFilter(name, key, link string) bson.D {
	or := bson.A{
		bson.D{{Key: "companyKey", Value: key}},
		bson.D{{Key: "companyName", Value: bson.D{
			{Key: "$regex", Value: "^" + regexp.QuoteMeta(name) + "$"},
			{Key: "$options", Value: "i"},
		}}},
	}
	for _, variant := range crawledCompanyLinks(link) {
		or = append(or,
			bson.D{{Key: "companyUrl", Value: variant}},
			bson.D{{Key: "companyLink", Value: variant}},
		)
	}
	return bson.D{{Key: "$or", Value: or}}
}

// crawledCompanyLinks lists the website strings an existing company might be
// stored under: the gathered link, that link without a trailing slash, and the
// canonical host form.
func crawledCompanyLinks(link string) []string {
	link = strings.TrimSpace(link)
	seen := map[string]struct{}{}
	out := make([]string, 0, 3)
	add := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		if _, ok := seen[value]; ok {
			return
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	add(link)
	add(strings.TrimRight(link, "/"))
	add(CanonicalApplyURL(link))
	return out
}

// crawledCompanyDocument is one temp_companies row gathered from a job board.
// companyUrl repeats companyLink so research and the directory, which read
// companyUrl, see the website.
func crawledCompanyDocument(id, sourceID string, job CrawledJob, now time.Time) bson.D {
	name := strings.TrimSpace(job.Company.Name)
	link := strings.TrimSpace(job.CompanyLink)
	doc := bson.D{
		{Key: "id", Value: id},
		{Key: "sourceId", Value: sourceID},
		{Key: "companyName", Value: name},
		{Key: "companyLink", Value: link},
		{Key: "companyUrl", Value: link},
		{Key: "companyKey", Value: companySlug(name)},
		{Key: "companyLogo", Value: strings.TrimSpace(job.Company.Logo)},
		{Key: "jobCount", Value: int64(0)},
		{Key: "jobIds", Value: bson.A{}},
		{Key: "source", Value: CrawlerIngest},
		{Key: "createdAt", Value: now.UTC()},
	}
	if meta := crawledCompanyMetadata(job.Company); len(meta) > 0 {
		doc = append(doc, bson.E{Key: "metadata", Value: meta})
	}
	return doc
}

// crawledCompanyMetadata is the board-specific company fields. Name and logo are
// stored on their own, so they are left out here. Empty values are left out too,
// which is how a board that does not show tags stores no tags.
func crawledCompanyMetadata(company CrawledCompany) bson.D {
	meta := make(map[string]any, len(company.Metadata)+1)
	for key, value := range company.Metadata {
		meta[key] = value
	}
	if _, ok := meta["tags"]; !ok && len(company.Tags) > 0 {
		meta["tags"] = company.Tags
	}
	keys := make([]string, 0, len(meta))
	for key := range meta {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	doc := make(bson.D, 0, len(keys))
	for _, key := range keys {
		cleanedKey := strings.TrimSpace(key)
		if cleanedKey == "" || cleanedKey == "name" || cleanedKey == "logo" || strings.ContainsAny(cleanedKey, ".$") {
			continue
		}
		cleaned := cleanMetadataValue(meta[key])
		if cleaned == nil {
			continue
		}
		doc = append(doc, bson.E{Key: cleanedKey, Value: cleaned})
	}
	return doc
}

func cleanMetadataValue(value any) any {
	switch typed := value.(type) {
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return nil
		}
		return trimmed
	case bool, float64, int, int32, int64:
		return typed
	case []string:
		cleaned := cleanStrings(typed)
		if len(cleaned) == 0 {
			return nil
		}
		return cleaned
	case []any:
		out := make(bson.A, 0, len(typed))
		for _, item := range typed {
			cleaned := cleanMetadataValue(item)
			if cleaned == nil {
				continue
			}
			out = append(out, cleaned)
		}
		if len(out) == 0 {
			return nil
		}
		return out
	case map[string]any:
		nested := crawledCompanyMetadata(CrawledCompany{Metadata: typed})
		if len(nested) == 0 {
			return nil
		}
		return nested
	default:
		return nil
	}
}
