package scout

import (
	"context"
	"strings"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	MatchKindLink         = "link"
	MatchKindCompanyTitle = "company_title"
	maxMatches            = 10
)

// Match is an existing job or submission that might be the same opening.
type Match struct {
	Kind         string `json:"kind" bson:"kind"`
	JobID        string `json:"job_id,omitempty" bson:"jobId,omitempty"`
	SubmissionID string `json:"submission_id,omitempty" bson:"submissionId,omitempty"`
	Title        string `json:"title" bson:"title"`
	Company      string `json:"company" bson:"company"`
	ApplyLink    string `json:"apply_link" bson:"applyLink"`
}

// MatchQuery is what the scout form sends to look for existing jobs.
type MatchQuery struct {
	URL         string `json:"url"`
	CompanyID   string `json:"company_id"`
	CompanyName string `json:"company_name"`
	Title       string `json:"title"`
}

// MatchResult is the list of possible duplicates.
type MatchResult struct {
	Matches []Match `json:"matches"`
}

type matchSet struct {
	items []Match
	seen  map[string]int
}

func newMatchSet() *matchSet {
	return &matchSet{items: []Match{}, seen: map[string]int{}}
}

func (s *matchSet) add(m Match) {
	key := ""
	switch {
	case m.JobID != "":
		key = "job:" + m.JobID
	case m.SubmissionID != "":
		key = "sub:" + m.SubmissionID
	default:
		key = m.Kind + ":" + m.ApplyLink + ":" + m.Title
	}
	if i, ok := s.seen[key]; ok {
		if s.items[i].Kind != MatchKindLink && m.Kind == MatchKindLink {
			s.items[i] = m
		}
		return
	}
	if len(s.items) >= maxMatches {
		return
	}
	s.seen[key] = len(s.items)
	s.items = append(s.items, m)
}

func matchLabel(m Match) string {
	if m.JobID != "" {
		return "job " + m.JobID
	}
	if m.SubmissionID != "" {
		return "submission " + m.SubmissionID
	}
	return m.Title
}

// FindMatches lists live jobs and non-expired submissions that share this
// apply link or the same company and title. Nothing is stored.
func (s *Store) FindMatches(ctx context.Context, query MatchQuery, self bson.ObjectID) ([]Match, error) {
	url := strings.TrimSpace(query.URL)
	parsed, err := ParseJobURL(url)
	if err != nil {
		return nil, &ValidationError{Fields: []FieldError{{Field: "url", Detail: err.Error()}}}
	}
	out := newMatchSet()
	if err := s.matchByLink(ctx, parsed, self, out); err != nil {
		return nil, err
	}
	companyID := strings.TrimSpace(query.CompanyID)
	company := strings.TrimSpace(query.CompanyName)
	title := strings.TrimSpace(query.Title)
	if company != "" || companyID != "" {
		if title != "" {
			if err := s.matchByCompanyTitle(ctx, companyID, company, title, self, out); err != nil {
				return nil, err
			}
		}
	}
	return out.items, nil
}

func (s *Store) matchByLink(ctx context.Context, parsed ParsedURL, self bson.ObjectID, out *matchSet) error {
	canonicals := []string{parsed.Canonical}
	links := URLVariants(parsed)
	cursor, err := s.collection(submissionsCollection).Find(ctx, bson.D{
		{Key: "_id", Value: bson.D{{Key: "$ne", Value: self}}},
		{Key: "canonicalUrl", Value: bson.D{{Key: "$in", Value: canonicals}}},
		{Key: "expired", Value: false},
	}, options.Find().SetLimit(maxMatches).SetSort(bson.D{{Key: "_id", Value: -1}}))
	if err != nil {
		return err
	}
	var subs []Submission
	if err := cursor.All(ctx, &subs); err != nil {
		return err
	}
	for _, sub := range subs {
		sub.fill()
		out.add(Match{
			Kind:         MatchKindLink,
			SubmissionID: sub.ID,
			JobID:        sub.JobID,
			Title:        sub.Title,
			Company:      sub.CompanyName,
			ApplyLink:    sub.URL,
		})
	}
	if s.publisher == nil {
		return nil
	}
	jobs, err := s.publisher.JobsWithApplyLink(ctx, links)
	if err != nil {
		return err
	}
	for _, job := range jobs {
		out.add(matchFromJob(MatchKindLink, job))
	}
	return nil
}

func (s *Store) matchByCompanyTitle(ctx context.Context, companyID, company, title string, self bson.ObjectID, out *matchSet) error {
	key := DedupeKey(companyID, company, title)
	if key == "|" || strings.HasPrefix(key, "|") || strings.HasSuffix(key, "|") {
		if Slug(title) == "" {
			return nil
		}
	}
	cursor, err := s.collection(submissionsCollection).Find(ctx, bson.D{
		{Key: "_id", Value: bson.D{{Key: "$ne", Value: self}}},
		{Key: "dedupeKey", Value: key},
		{Key: "expired", Value: false},
	}, options.Find().SetLimit(maxMatches).SetSort(bson.D{{Key: "_id", Value: -1}}))
	if err != nil {
		return err
	}
	var subs []Submission
	if err := cursor.All(ctx, &subs); err != nil {
		return err
	}
	for _, sub := range subs {
		sub.fill()
		out.add(Match{
			Kind:         MatchKindCompanyTitle,
			SubmissionID: sub.ID,
			JobID:        sub.JobID,
			Title:        sub.Title,
			Company:      sub.CompanyName,
			ApplyLink:    sub.URL,
		})
	}
	if s.publisher == nil {
		return nil
	}
	found, err := s.publisher.JobsMatchingCompanyTitle(ctx, companyID, company, title)
	if err != nil {
		return err
	}
	for _, job := range found {
		out.add(matchFromJob(MatchKindCompanyTitle, job))
	}
	return nil
}

func matchFromJob(kind string, job jobs.JobBrief) Match {
	return Match{
		Kind:      kind,
		JobID:     job.ID,
		Title:     job.Title,
		Company:   job.Company,
		ApplyLink: job.ApplyLink,
	}
}

func factsFromMatches(matches []Match) (duplicate, similar string) {
	for _, m := range matches {
		label := matchLabel(m)
		if m.Kind == MatchKindLink && duplicate == "" {
			duplicate = label
			continue
		}
		if similar == "" {
			similar = label
		}
	}
	return duplicate, similar
}
