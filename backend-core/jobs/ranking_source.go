package jobs

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// rankingScanBatch is how many documents one round trip of a ranking scan pulls.
const rankingScanBatch = 2000

// RankingDoc is the part of a public job the ranking index reads: everything a
// filter, a feature, or an embedding needs, and nothing the job page shows only.
type RankingDoc struct {
	JobID      string
	Title      string
	Company    string
	CompanyID  string
	Location   string
	Workplace  string
	Seniority  string
	Employment string
	Pay        Pay
	Visa       bool
	Skills     []string
	Summary    string
	Team       string
	Applicants int
	// Source is job.source (aggregated, direct, scouted); Hidden is the scouted check.
	Source     string
	Hidden     bool
	DedupeKey  string
	PostedAt   time.Time
	AnalyzedAt time.Time
}

type storedRankingDoc struct {
	PostedAt   time.Time `bson:"postedAt"`
	AnalyzedAt time.Time `bson:"analyzedAt"`
	Source     string    `bson:"source"`
	DedupeKey  string    `bson:"dedupeKey"`
	Job        struct {
		ID         string   `bson:"id"`
		Title      string   `bson:"title"`
		Company    string   `bson:"company"`
		CompanyID  string   `bson:"companyId"`
		Location   string   `bson:"location"`
		Workplace  string   `bson:"workplace"`
		Seniority  string   `bson:"seniority"`
		Employment string   `bson:"employment"`
		Pay        Pay      `bson:"pay"`
		Visa       bool     `bson:"visa"`
		Skills     []string `bson:"skills"`
		Summary    string   `bson:"summary"`
		Team       string   `bson:"team"`
		Applicants int      `bson:"applicants"`
		Source     string   `bson:"source"`
	} `bson:"job"`
}

var rankingProjection = bson.D{
	{Key: "postedAt", Value: 1}, {Key: "analyzedAt", Value: 1}, {Key: "source", Value: 1},
	{Key: "dedupeKey", Value: 1}, {Key: "job.id", Value: 1}, {Key: "job.title", Value: 1},
	{Key: "job.company", Value: 1}, {Key: "job.companyId", Value: 1}, {Key: "job.location", Value: 1},
	{Key: "job.workplace", Value: 1}, {Key: "job.seniority", Value: 1}, {Key: "job.employment", Value: 1},
	{Key: "job.pay", Value: 1}, {Key: "job.visa", Value: 1}, {Key: "job.skills", Value: 1},
	{Key: "job.summary", Value: 1}, {Key: "job.team", Value: 1}, {Key: "job.applicants", Value: 1},
	{Key: "job.source", Value: 1},
}

func (doc storedRankingDoc) rankingDoc() RankingDoc {
	return RankingDoc{
		JobID:      doc.Job.ID,
		Title:      doc.Job.Title,
		Company:    doc.Job.Company,
		CompanyID:  doc.Job.CompanyID,
		Location:   doc.Job.Location,
		Workplace:  doc.Job.Workplace,
		Seniority:  doc.Job.Seniority,
		Employment: doc.Job.Employment,
		Pay:        doc.Job.Pay,
		Visa:       doc.Job.Visa,
		Skills:     cleanList(doc.Job.Skills, maxSkills),
		Summary:    doc.Job.Summary,
		Team:       doc.Job.Team,
		Applicants: doc.Job.Applicants,
		Source:     doc.Job.Source,
		Hidden:     isHiddenJob(doc.Job.Source, doc.Source),
		DedupeKey:  doc.DedupeKey,
		PostedAt:   doc.PostedAt,
		AnalyzedAt: doc.AnalyzedAt,
	}
}

// ScanRankingDocs streams every public job analyzed after since (all public jobs
// when since is zero), oldest analysis first, so a caller can keep since as a
// watermark. It reads a narrow projection and never writes.
func (s *Store) ScanRankingDocs(ctx context.Context, since time.Time, fn func(RankingDoc) error) error {
	filter := publicListingFilter()
	if !since.IsZero() {
		filter = bson.D{{Key: "$and", Value: bson.A{filter, bson.D{{Key: "analyzedAt", Value: bson.D{{Key: "$gt", Value: since}}}}}}}
	}
	opts := options.Find().
		SetProjection(rankingProjection).
		SetSort(bson.D{{Key: "analyzedAt", Value: 1}, {Key: "_id", Value: 1}}).
		SetBatchSize(rankingScanBatch)
	cursor, err := s.structured().Find(ctx, filter, opts)
	if err != nil {
		return fmt.Errorf("scan ranking docs: %w", err)
	}
	defer cursor.Close(ctx)
	for cursor.Next(ctx) {
		var doc storedRankingDoc
		if err := cursor.Decode(&doc); err != nil {
			return fmt.Errorf("decode ranking doc: %w", err)
		}
		if doc.Job.ID == "" {
			continue
		}
		if err := fn(doc.rankingDoc()); err != nil {
			return err
		}
	}
	if err := cursor.Err(); err != nil {
		return fmt.Errorf("scan ranking docs: %w", err)
	}
	return nil
}

// CompanySignals reports, per company id, how complete its public page is (0–1):
// a name, a site, and a logo each count a third. Ranking reads it as a light
// trust signal; it never decides whether a job shows.
func (s *Store) CompanySignals(ctx context.Context) (map[string]float32, error) {
	cursor, err := s.companies().Find(ctx, bson.D{}, options.Find().SetProjection(bson.D{
		{Key: "id", Value: 1}, {Key: "companyName", Value: 1}, {Key: "companyUrl", Value: 1},
		{Key: "companyLogo", Value: 1}, {Key: "logoFile.contentType", Value: 1}, {Key: "overrides", Value: 1},
	}).SetBatchSize(rankingScanBatch))
	if err != nil {
		return nil, fmt.Errorf("scan company signals: %w", err)
	}
	defer cursor.Close(ctx)
	out := map[string]float32{}
	for cursor.Next(ctx) {
		var doc storedCompany
		if err := cursor.Decode(&doc); err != nil {
			return nil, fmt.Errorf("decode company signal: %w", err)
		}
		if doc.ID == "" {
			continue
		}
		profile := doc.publicCompany()
		var score float32
		for _, present := range []bool{profile.Name != "", profile.URL != "", profile.Logo != ""} {
			if present {
				score += 1.0 / 3
			}
		}
		out[doc.ID] = score
	}
	if err := cursor.Err(); err != nil {
		return nil, fmt.Errorf("scan company signals: %w", err)
	}
	return out, nil
}

// CatalogJobsByIDs loads public jobs by job id, in the order given, with their
// company briefs. Ids that are missing or no longer public are skipped, so a
// ranked list from a slightly stale index still only shows live jobs.
func (s *Store) CatalogJobsByIDs(ctx context.Context, ids []string, now time.Time) ([]catalogJob, error) {
	if len(ids) == 0 {
		return []catalogJob{}, nil
	}
	filter := bson.D{{Key: "$and", Value: bson.A{
		publicListingFilter(),
		bson.D{{Key: "job.id", Value: bson.D{{Key: "$in", Value: ids}}}},
	}}}
	cursor, err := s.structured().Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("load jobs by id: %w", err)
	}
	defer cursor.Close(ctx)
	byID := make(map[string]catalogJob, len(ids))
	for cursor.Next(ctx) {
		var doc storedSearchJob
		if err := cursor.Decode(&doc); err != nil {
			return nil, fmt.Errorf("decode job: %w", err)
		}
		byID[doc.Job.ID] = CatalogJob(doc.view(now))
	}
	if err := cursor.Err(); err != nil {
		return nil, fmt.Errorf("load jobs by id: %w", err)
	}
	ordered := make([]catalogJob, 0, len(byID))
	for _, id := range ids {
		if job, ok := byID[id]; ok {
			ordered = append(ordered, job)
			delete(byID, id)
		}
	}
	return s.enrichCompanies(ctx, ordered)
}

// rankingIndexes are the indexes the ranking sync and hydration read through.
func rankingIndexes() []mongo.IndexModel {
	return []mongo.IndexModel{
		{Keys: bson.D{{Key: "job.id", Value: 1}}, Options: options.Index().SetName("job_id")},
		{Keys: bson.D{{Key: "analyzedAt", Value: 1}, {Key: "_id", Value: 1}}, Options: options.Index().SetName("analyzed_at")},
	}
}
