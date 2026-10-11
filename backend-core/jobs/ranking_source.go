package jobs

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// rankingScanBatch is how many documents one round trip of a ranking scan pulls.
const rankingScanBatch = 2000

// RankingDoc is the part of a public job the ranking index reads: everything a
// filter, a feature, or an embedding needs, and nothing the job page shows only.
type RankingDoc struct {
	JobID string
	// ObjectID is the Mongo _id (hex): hydration and incremental scans read through
	// the _id index, so ranking needs no index of its own.
	ObjectID   string
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
	ID         bson.ObjectID `bson:"_id"`
	PostedAt   time.Time     `bson:"postedAt"`
	AnalyzedAt time.Time     `bson:"analyzedAt"`
	Source     string        `bson:"source"`
	DedupeKey  string        `bson:"dedupeKey"`
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
		ObjectID:   doc.ID.Hex(),
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

// ScanRankingDocs streams public jobs in _id order: every one when afterID is
// blank, else only those inserted after the job with that _id. Insertion order
// makes afterID a watermark for new jobs; edits to existing jobs are picked up by
// the next full scan. It reads a narrow projection through the _id index and
// never writes.
func (s *Store) ScanRankingDocs(ctx context.Context, afterID string, fn func(RankingDoc) error) error {
	filter := publicListingFilter()
	if afterID != "" {
		after, err := bson.ObjectIDFromHex(afterID)
		if err != nil {
			return fmt.Errorf("scan ranking docs: bad watermark %q: %w", afterID, err)
		}
		filter = bson.D{{Key: "$and", Value: bson.A{filter, bson.D{{Key: "_id", Value: bson.D{{Key: "$gt", Value: after}}}}}}}
	}
	opts := options.Find().
		SetProjection(rankingProjection).
		SetSort(bson.D{{Key: "_id", Value: 1}}).
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

// CatalogJobsByObjectIDs loads public jobs by Mongo _id (hex), in the order given,
// with their company briefs. Ids that are missing or no longer public are
// skipped, so a ranked list from a slightly stale index still only shows live jobs.
func (s *Store) CatalogJobsByObjectIDs(ctx context.Context, objectIDs []string, now time.Time) ([]catalogJob, error) {
	if len(objectIDs) == 0 {
		return []catalogJob{}, nil
	}
	byID, missing := s.hydrated.get(objectIDs, now)
	if len(missing) > 0 {
		loaded, err := s.loadCatalogJobs(ctx, missing, now)
		if err != nil {
			return nil, err
		}
		for id, entry := range loaded {
			byID[id] = entry.job
			s.hydrated.put(id, entry.job, entry.postedAt, now)
		}
	}
	ordered := make([]catalogJob, 0, len(byID))
	for _, hex := range objectIDs {
		if job, ok := byID[hex]; ok {
			ordered = append(ordered, job)
			delete(byID, hex)
		}
	}
	return ordered, nil
}

// loadCatalogJobs reads public jobs by _id and attaches their company profiles.
func (s *Store) loadCatalogJobs(ctx context.Context, objectIDs []string, now time.Time) (map[string]hydratedJob, error) {
	ids := make(bson.A, 0, len(objectIDs))
	for _, hex := range objectIDs {
		if id, err := bson.ObjectIDFromHex(hex); err == nil {
			ids = append(ids, id)
		}
	}
	filter := bson.D{{Key: "$and", Value: bson.A{
		publicListingFilter(),
		bson.D{{Key: "_id", Value: bson.D{{Key: "$in", Value: ids}}}},
	}}}
	cursor, err := s.structured().Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("load jobs by id: %w", err)
	}
	defer cursor.Close(ctx)
	var keys []string
	var posted []time.Time
	var jobs []catalogJob
	for cursor.Next(ctx) {
		var doc storedSearchJob
		if err := cursor.Decode(&doc); err != nil {
			return nil, fmt.Errorf("decode job: %w", err)
		}
		keys = append(keys, doc.ID.Hex())
		posted = append(posted, doc.PostedAt)
		jobs = append(jobs, CatalogJob(doc.view(now)))
	}
	if err := cursor.Err(); err != nil {
		return nil, fmt.Errorf("load jobs by id: %w", err)
	}
	jobs, err = s.enrichCompanies(ctx, jobs)
	if err != nil {
		return nil, fmt.Errorf("enrich companies: %w", err)
	}
	out := make(map[string]hydratedJob, len(jobs))
	for i, job := range jobs {
		out[keys[i]] = hydratedJob{job: job, postedAt: posted[i]}
	}
	return out, nil
}
