package jobs

import (
	"context"
	"regexp"
	"strings"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const companyTitleScan = 200

// JobBrief is enough of a live job to show a possible duplicate.
type JobBrief struct {
	ID               string   `json:"id"`
	Title            string   `json:"title"`
	Company          string   `json:"company"`
	CompanyID        string   `json:"companyId"`
	ApplyLink        string   `json:"applyLink"`
	SourceRef        string   `json:"-"`
	Summary          string   `json:"summary"`
	Responsibilities []string `json:"responsibilities"`
	Requirements     []string `json:"requirements"`
}

func (s *Store) JobsWithApplyLink(ctx context.Context, links []string) ([]JobBrief, error) {
	if len(links) == 0 {
		return nil, nil
	}
	return s.findJobBriefs(ctx, bson.D{{Key: "applyLink", Value: bson.D{{Key: "$in", Value: links}}}}, 20)
}

// JobWithApplyLink returns the public id of a live job whose apply link is one
// of links, or "" when none is.
func (s *Store) JobWithApplyLink(ctx context.Context, links []string) (string, error) {
	jobs, err := s.JobsWithApplyLink(ctx, links)
	if err != nil || len(jobs) == 0 {
		return "", err
	}
	return jobs[0].ID, nil
}

// JobsMatchingCompanyTitle returns live jobs whose company (id, else name slug)
// and title slug match. Location is ignored.
func (s *Store) JobsMatchingCompanyTitle(ctx context.Context, companyID, companyName, title string) ([]JobBrief, error) {
	wantTitle := companySlug(title)
	if wantTitle == "" {
		return nil, nil
	}
	companyID = strings.TrimSpace(companyID)
	var filter bson.D
	if companyID != "" {
		filter = bson.D{{Key: "job.companyId", Value: companyID}}
	} else if strings.TrimSpace(companyName) != "" {
		filter = bson.D{{Key: "job.title", Value: bson.D{
			{Key: "$regex", Value: titleExactRegex(title)},
			{Key: "$options", Value: "i"},
		}}}
	} else {
		return nil, nil
	}
	limit := int64(companyTitleScan)
	if companyID == "" {
		limit = duplicateTitlePool
	}
	briefs, err := s.findJobBriefs(ctx, filter, limit)
	if err != nil {
		return nil, err
	}
	wantCompany := companySlug(companyName)
	out := make([]JobBrief, 0, len(briefs))
	for _, brief := range briefs {
		if companySlug(brief.Title) != wantTitle {
			continue
		}
		if companyID != "" {
			if brief.CompanyID != companyID {
				continue
			}
		} else if companySlug(brief.Company) != wantCompany {
			continue
		}
		out = append(out, brief)
	}
	return out, nil
}

func (s *Store) JobBriefsByID(ctx context.Context, ids []string) ([]JobBrief, error) {
	clean := make([]string, 0, len(ids))
	seen := map[string]struct{}{}
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		clean = append(clean, id)
	}
	if len(clean) == 0 {
		return nil, nil
	}
	return s.findJobBriefs(ctx, bson.D{{Key: "job.id", Value: bson.D{{Key: "$in", Value: clean}}}}, int64(len(clean)))
}

func (s *Store) TitlePool(ctx context.Context, title string, limit int) ([]JobBrief, error) {
	if limit <= 0 {
		limit = duplicateTitlePool
	}
	pattern := titleSearchRegex(title)
	if pattern == "" {
		return nil, nil
	}
	return s.findJobBriefs(ctx, bson.D{{Key: "job.title", Value: bson.D{
		{Key: "$regex", Value: pattern},
		{Key: "$options", Value: "i"},
	}}}, int64(limit))
}

func (s *Store) findJobBriefs(ctx context.Context, filter bson.D, limit int64) ([]JobBrief, error) {
	if limit < 1 {
		limit = 1
	}
	cursor, err := s.structured().Find(ctx, filter, options.Find().
		SetLimit(limit).
		SetProjection(bson.D{
			{Key: "job.id", Value: 1},
			{Key: "job.title", Value: 1},
			{Key: "job.company", Value: 1},
			{Key: "job.companyId", Value: 1},
			{Key: "applyLink", Value: 1},
			{Key: "sourceRef", Value: 1},
			{Key: "job.summary", Value: 1},
			{Key: "job.responsibilities", Value: 1},
			{Key: "job.requirements", Value: 1},
		}))
	if err != nil {
		return nil, err
	}
	var docs []storedSearchJob
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	out := make([]JobBrief, 0, len(docs))
	for _, doc := range docs {
		out = append(out, briefFrom(doc))
	}
	return out, nil
}

func briefFrom(doc storedSearchJob) JobBrief {
	return JobBrief{
		ID:               doc.Job.ID,
		Title:            doc.Job.Title,
		Company:          doc.Job.Company,
		CompanyID:        doc.Job.CompanyID,
		ApplyLink:        doc.ApplyLink,
		SourceRef:        doc.SourceRef,
		Summary:          doc.Job.Summary,
		Responsibilities: doc.Job.Responsibilities,
		Requirements:     doc.Job.Requirements,
	}
}

func titleExactRegex(title string) string {
	parts := strings.Split(companySlug(title), "-")
	quoted := make([]string, 0, len(parts))
	for _, part := range parts {
		if part == "" {
			continue
		}
		quoted = append(quoted, regexp.QuoteMeta(part))
	}
	if len(quoted) == 0 {
		return "^" + regexp.QuoteMeta(strings.TrimSpace(title)) + "$"
	}
	return "^" + strings.Join(quoted, "[^A-Za-z0-9]*") + "$"
}

var titleStop = map[string]struct{}{
	"a": {}, "an": {}, "the": {}, "of": {}, "and": {}, "or": {}, "to": {},
	"in": {}, "at": {}, "on": {}, "for": {}, "with": {},
}

func titleSearchRegex(title string) string {
	tokens := make([]string, 0, 8)
	for _, word := range strings.Fields(strings.ToLower(title)) {
		slug := companySlug(word)
		if len(slug) < 4 {
			continue
		}
		if _, stop := titleStop[slug]; stop {
			continue
		}
		tokens = append(tokens, regexp.QuoteMeta(word))
		if len(tokens) == 8 {
			break
		}
	}
	if len(tokens) == 0 {
		trimmed := strings.TrimSpace(title)
		if trimmed == "" {
			return ""
		}
		return regexp.QuoteMeta(trimmed)
	}
	return strings.Join(tokens, "|")
}
