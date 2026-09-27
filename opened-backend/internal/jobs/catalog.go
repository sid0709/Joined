package jobs

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type SearchRecord struct {
	Job        SearchJob `json:"job"`
	TempJobID  string    `json:"tempJobId"`
	ApplyLink  string    `json:"applyLink"`
	AnalyzedAt time.Time `json:"analyzedAt"`
	Model      string    `json:"model"`
}

type SearchList struct {
	Jobs     []SearchRecord `json:"jobs"`
	Total    int64          `json:"total"`
	Page     int64          `json:"page"`
	PageSize int64          `json:"pageSize"`
	Pending  int64          `json:"pending"`
}

type storedSearchJob struct {
	ID         bson.ObjectID `bson:"_id"`
	TempJobID  string        `bson:"tempJobId"`
	PostedAt   time.Time     `bson:"postedAt"`
	ApplyLink  string        `bson:"applyLink"`
	AnalyzedAt time.Time     `bson:"analyzedAt"`
	Model      string        `bson:"model"`
	Job        SearchJob     `bson:"job"`
}

type tempListing struct {
	ID          bson.ObjectID `bson:"_id"`
	Title       string        `bson:"title"`
	CompanyName string        `bson:"companyName"`
	Description string        `bson:"description"`
	CompanyID   bson.ObjectID `bson:"companyId"`
	ApplyLink   string        `bson:"applyLink"`
	PostedAt    time.Time     `bson:"postedAt"`
	Metadata    struct {
		Details struct {
			Location  string `bson:"location"`
			Time      string `bson:"time"`
			Remote    string `bson:"remote"`
			Seniority string `bson:"seniority"`
			Salary    string `bson:"salary"`
		} `bson:"details"`
	} `bson:"metadata"`
}

const maxSearchCatalog = 2000

type catalogJob struct {
	SearchJob
	ApplyLink   string `json:"applyLink,omitempty"`
	CompanyURL  string `json:"companyUrl,omitempty"`
	CompanyLogo string `json:"companyLogo,omitempty"`
}

type SearchCatalog struct {
	Jobs  []catalogJob `json:"jobs"`
	Total int64        `json:"total"`
}

func CatalogJob(record SearchRecord) catalogJob {
	return catalogJob{SearchJob: record.Job, ApplyLink: record.ApplyLink}
}

func (s *Store) ListCatalog(ctx context.Context, now time.Time) (SearchCatalog, error) {
	coll := s.structured()
	total, err := coll.CountDocuments(ctx, bson.D{})
	if err != nil {
		return SearchCatalog{}, err
	}
	opts := options.Find().
		SetLimit(maxSearchCatalog).
		SetSort(bson.D{{Key: "analyzedAt", Value: -1}, {Key: "_id", Value: -1}})
	cursor, err := coll.Find(ctx, bson.D{}, opts)
	if err != nil {
		return SearchCatalog{}, err
	}
	defer cursor.Close(ctx)

	var docs []storedSearchJob
	if err := cursor.All(ctx, &docs); err != nil {
		return SearchCatalog{}, err
	}
	jobs := make([]catalogJob, 0, len(docs))
	for _, doc := range docs {
		jobs = append(jobs, CatalogJob(doc.view(now)))
	}
	jobs, err = s.enrichCompanies(ctx, jobs)
	if err != nil {
		return SearchCatalog{}, err
	}
	return SearchCatalog{Jobs: jobs, Total: total}, nil
}

func (s *Store) enrichCompanies(ctx context.Context, jobs []catalogJob) ([]catalogJob, error) {
	if len(jobs) == 0 {
		return jobs, nil
	}
	ids := make([]string, 0, len(jobs))
	seen := map[string]struct{}{}
	for _, job := range jobs {
		if job.CompanyID == "" {
			continue
		}
		if _, ok := seen[job.CompanyID]; ok {
			continue
		}
		seen[job.CompanyID] = struct{}{}
		ids = append(ids, job.CompanyID)
	}
	if len(ids) == 0 {
		return jobs, nil
	}
	cursor, err := s.companies().Find(ctx, bson.D{{Key: "id", Value: bson.D{{Key: "$in", Value: ids}}}}, options.Find().SetProjection(bson.D{
		{Key: "id", Value: 1},
		{Key: "companyUrl", Value: 1},
		{Key: "companyLogo", Value: 1},
	}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	briefs := map[string]storedCompany{}
	for cursor.Next(ctx) {
		var doc storedCompany
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		briefs[doc.ID] = doc
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	for i := range jobs {
		brief, ok := briefs[jobs[i].CompanyID]
		if !ok {
			continue
		}
		jobs[i].CompanyURL = brief.CompanyURL
		jobs[i].CompanyLogo = brief.CompanyLogo
	}
	return jobs, nil
}

func (s *Store) ListSearch(ctx context.Context, query ListQuery, now time.Time) (SearchList, error) {
	coll := s.structured()
	filter := searchFilter(query.Q)
	total, err := coll.CountDocuments(ctx, filter)
	if err != nil {
		return SearchList{}, err
	}
	opts := options.Find().
		SetSkip((query.Page - 1) * query.PageSize).
		SetLimit(query.PageSize).
		SetSort(bson.D{{Key: "analyzedAt", Value: -1}, {Key: "_id", Value: -1}})
	cursor, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return SearchList{}, err
	}
	defer cursor.Close(ctx)

	var docs []storedSearchJob
	if err := cursor.All(ctx, &docs); err != nil {
		return SearchList{}, err
	}
	records := make([]SearchRecord, 0, len(docs))
	for _, doc := range docs {
		records = append(records, doc.view(now))
	}
	pending, err := s.pendingCount(ctx)
	if err != nil {
		return SearchList{}, err
	}
	return SearchList{
		Jobs:     records,
		Total:    total,
		Page:     query.Page,
		PageSize: query.PageSize,
		Pending:  pending,
	}, nil
}

func (s *Store) GetSearch(ctx context.Context, id string, now time.Time) (SearchRecord, error) {
	coll := s.structured()
	var doc storedSearchJob
	if objectID, err := bson.ObjectIDFromHex(id); err == nil {
		err = coll.FindOne(ctx, bson.D{{Key: "_id", Value: objectID}}).Decode(&doc)
		if errors.Is(err, mongo.ErrNoDocuments) {
			return SearchRecord{}, ErrNotFound
		}
		if err != nil {
			return SearchRecord{}, err
		}
		return doc.view(now), nil
	}

	err := coll.FindOne(ctx, bson.D{{Key: "job.id", Value: id}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return SearchRecord{}, ErrNotFound
	}
	if err != nil {
		return SearchRecord{}, err
	}
	return doc.view(now), nil
}

func (s *Store) nextTempListing(ctx context.Context) (tempListing, error) {
	cursor, err := s.dest().Aggregate(ctx, mongo.Pipeline{
		bson.D{{Key: "$lookup", Value: bson.D{
			{Key: "from", Value: s.structuredCollection},
			{Key: "localField", Value: "_id"},
			{Key: "foreignField", Value: "_id"},
			{Key: "as", Value: "structured"},
		}}},
		bson.D{{Key: "$match", Value: bson.D{{Key: "structured", Value: bson.D{{Key: "$size", Value: 0}}}}}},
		bson.D{{Key: "$sort", Value: bson.D{{Key: "postedAt", Value: -1}}}},
		bson.D{{Key: "$limit", Value: 1}},
		bson.D{{Key: "$project", Value: bson.D{{Key: "structured", Value: 0}}}},
	})
	if err != nil {
		return tempListing{}, err
	}
	defer cursor.Close(ctx)
	if !cursor.Next(ctx) {
		if err := cursor.Err(); err != nil {
			return tempListing{}, err
		}
		return tempListing{}, ErrNonePending
	}
	var listing tempListing
	if err := cursor.Decode(&listing); err != nil {
		return tempListing{}, err
	}
	return listing, nil
}

func (s *Store) tempListing(ctx context.Context, id bson.ObjectID) (tempListing, error) {
	var listing tempListing
	err := s.dest().FindOne(ctx, bson.D{{Key: "_id", Value: id}}).Decode(&listing)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return tempListing{}, ErrNotFound
	}
	return listing, err
}

func (s *Store) saveSearchJob(ctx context.Context, doc storedSearchJob) error {
	_, err := s.structured().ReplaceOne(
		ctx,
		bson.D{{Key: "_id", Value: doc.ID}},
		doc,
		options.Replace().SetUpsert(true),
	)
	return err
}

func (s *Store) pendingCount(ctx context.Context) (int64, error) {
	tempCount, err := s.dest().CountDocuments(ctx, bson.D{})
	if err != nil {
		return 0, err
	}
	structured, err := s.structured().CountDocuments(ctx, bson.D{})
	if err != nil {
		return 0, err
	}
	pending := tempCount - structured
	if pending < 0 {
		return 0, nil
	}
	return pending, nil
}

func (s *Store) analyzedIDs(ctx context.Context, ids []bson.ObjectID) ([]string, error) {
	if len(ids) == 0 {
		return []string{}, nil
	}
	cursor, err := s.structured().Find(
		ctx,
		bson.D{{Key: "_id", Value: bson.D{{Key: "$in", Value: ids}}}},
		options.Find().SetProjection(bson.D{{Key: "_id", Value: 1}}),
	)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	found := make([]string, 0, len(ids))
	for cursor.Next(ctx) {
		var doc struct {
			ID bson.ObjectID `bson:"_id"`
		}
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		found = append(found, doc.ID.Hex())
	}
	return found, cursor.Err()
}

func (s *Store) structured() *mongo.Collection {
	return s.client.Database(s.destDB).Collection(s.structuredCollection)
}

func (doc storedSearchJob) view(now time.Time) SearchRecord {
	job := doc.Job
	job.PostedHoursAgo = hoursSince(doc.PostedAt, now)
	job.Skills = cleanList(job.Skills, maxSkills)
	job.Responsibilities = cleanList(job.Responsibilities, maxBullets)
	job.Requirements = cleanList(job.Requirements, maxBullets)
	job.Benefits = cleanList(job.Benefits, maxBullets)
	return SearchRecord{
		Job:        job,
		TempJobID:  doc.TempJobID,
		ApplyLink:  doc.ApplyLink,
		AnalyzedAt: doc.AnalyzedAt,
		Model:      doc.Model,
	}
}

func searchFilter(q string) bson.D {
	pattern := searchPattern(q)
	if pattern == "" {
		return bson.D{}
	}
	regex := bson.D{{Key: "$regex", Value: pattern}, {Key: "$options", Value: "i"}}
	return bson.D{{Key: "$or", Value: bson.A{
		bson.D{{Key: "job.title", Value: regex}},
		bson.D{{Key: "job.company", Value: regex}},
	}}}
}
