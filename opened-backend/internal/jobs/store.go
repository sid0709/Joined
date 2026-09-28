package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"sync"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var (
	ErrNotFound          = errors.New("job not found")
	ErrInvalidID         = errors.New("invalid job id")
	ErrCopyInProgress    = errors.New("a copy is already running")
	ErrAnalyzeInProgress = errors.New("an analysis is already running")
	ErrNonePending       = errors.New("every temp job already has a search record")
	ErrInvalidInput      = errors.New("check the form and try again")
)

type ListResult struct {
	Jobs        []json.RawMessage `json:"jobs"`
	AnalyzedIDs []string          `json:"analyzedIds"`
	Total       int64             `json:"total"`
	Page        int64             `json:"page"`
	PageSize    int64             `json:"pageSize"`
}

type CopyResult struct {
	Copied      int64  `json:"copied"`
	Source      string `json:"source"`
	Destination string `json:"destination"`
	Indexes     int    `json:"indexes"`
}

type Store struct {
	client               *mongo.Client
	sourceDB             string
	sourceCollection     string
	destDB               string
	destCollection       string
	structuredCollection string
	sourceCompanies      string
	destCompanies        string
	copyMu               sync.Mutex
	analyzeMu            sync.Mutex
}

func NewStore(client *mongo.Client, sourceDB, sourceCollection, destDB, destCollection, structuredCollection, sourceCompanies, destCompanies string) *Store {
	return &Store{
		client:               client,
		sourceDB:             sourceDB,
		sourceCollection:     sourceCollection,
		destDB:               destDB,
		destCollection:       destCollection,
		structuredCollection: structuredCollection,
		sourceCompanies:      sourceCompanies,
		destCompanies:        destCompanies,
	}
}

func (s *Store) Ping(ctx context.Context) error {
	return s.client.Ping(ctx, nil)
}

func (s *Store) List(ctx context.Context, query ListQuery) (ListResult, error) {
	coll := s.dest()
	filter, err := s.tempFilter(ctx, query)
	if err != nil {
		return ListResult{}, err
	}
	total, err := coll.CountDocuments(ctx, filter)
	if err != nil {
		return ListResult{}, err
	}

	opts := options.Find().
		SetSkip((query.Page - 1) * query.PageSize).
		SetLimit(query.PageSize).
		SetSort(bson.D{{Key: "postedAt", Value: -1}, {Key: "_id", Value: -1}}).
		SetProjection(listProjection)
	cursor, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return ListResult{}, err
	}
	defer cursor.Close(ctx)

	var docs []bson.M
	if err := cursor.All(ctx, &docs); err != nil {
		return ListResult{}, err
	}

	jobs := make([]json.RawMessage, 0, len(docs))
	ids := make([]bson.ObjectID, 0, len(docs))
	for _, doc := range docs {
		if id, ok := doc["_id"].(bson.ObjectID); ok {
			ids = append(ids, id)
		}
		raw, err := documentJSON(doc)
		if err != nil {
			return ListResult{}, err
		}
		jobs = append(jobs, raw)
	}
	analyzedIDs, err := s.analyzedIDs(ctx, ids)
	if err != nil {
		return ListResult{}, err
	}

	return ListResult{
		Jobs:        jobs,
		AnalyzedIDs: analyzedIDs,
		Total:       total,
		Page:        query.Page,
		PageSize:    query.PageSize,
	}, nil
}

func (s *Store) Get(ctx context.Context, idHex string) (json.RawMessage, error) {
	id, err := bson.ObjectIDFromHex(idHex)
	if err != nil {
		return nil, ErrInvalidID
	}

	var doc bson.M
	err = s.dest().FindOne(ctx, bson.D{{Key: "_id", Value: id}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return documentJSON(doc)
}

func (s *Store) tempFilter(ctx context.Context, query ListQuery) (bson.D, error) {
	filter := listFilter(query.Q)
	if !query.HideAnalyzed {
		return filter, nil
	}
	ids, err := s.analyzedObjectIDs(ctx)
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return filter, nil
	}
	return append(filter, bson.E{Key: "_id", Value: bson.D{{Key: "$nin", Value: ids}}}), nil
}

func (s *Store) source() *mongo.Collection {
	return s.client.Database(s.sourceDB).Collection(s.sourceCollection)
}

func (s *Store) dest() *mongo.Collection {
	return s.client.Database(s.destDB).Collection(s.destCollection)
}

var listProjection = bson.D{
	{Key: "title", Value: 1},
	{Key: "companyName", Value: 1},
	{Key: "companyLink", Value: 1},
	{Key: "applyLink", Value: 1},
	{Key: "source", Value: 1},
	{Key: "sourceCatalog", Value: 1},
	{Key: "createdBy", Value: 1},
	{Key: "titleReviewLabel", Value: 1},
	{Key: "aiSkillStatus", Value: 1},
	{Key: "postedAt", Value: 1},
	{Key: "createdAt", Value: 1},
	{Key: "companyId", Value: 1},
	{Key: "metadata.companyLogo", Value: 1},
	{Key: "metadata.details", Value: 1},
}
