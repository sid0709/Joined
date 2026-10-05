package jobscam

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type storedHold struct {
	ID          string    `bson:"_id"`
	JobID       string    `bson:"jobId"`
	ListingID   string    `bson:"listingId,omitempty"`
	Title       string    `bson:"title"`
	Company     string    `bson:"company"`
	CompanyID   string    `bson:"companyId,omitempty"`
	ApplyURL    string    `bson:"applyUrl,omitempty"`
	Source      string    `bson:"source,omitempty"`
	Score       int       `bson:"score"`
	Threshold   int       `bson:"threshold"`
	Reasons     []Reason  `bson:"reasons"`
	Status      string    `bson:"status"`
	Fingerprint string    `bson:"fingerprint"`
	HeldAt      time.Time `bson:"heldAt"`
	ReviewedAt  time.Time `bson:"reviewedAt,omitempty"`
	ReviewedBy  string    `bson:"reviewedBy,omitempty"`
	ReviewNote  string    `bson:"reviewNote,omitempty"`
}

// Store is the Mongo Holds implementation.
type Store struct {
	coll *mongo.Collection
}

func NewStore(client *mongo.Client, db string) *Store {
	if client == nil {
		return nil
	}
	return &Store{coll: client.Database(db).Collection(holdsCollection)}
}

func (s *Store) EnsureIndexes(ctx context.Context) error {
	if s == nil || s.coll == nil {
		return nil
	}
	_, err := s.coll.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "status", Value: 1}, {Key: "heldAt", Value: -1}}},
		{Keys: bson.D{{Key: "fingerprint", Value: 1}}},
		{Keys: bson.D{{Key: "jobId", Value: 1}}},
	})
	if err != nil {
		return fmt.Errorf("job scam hold indexes: %w", err)
	}
	return nil
}

func (s *Store) Get(ctx context.Context, id string) (Hold, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return Hold{}, ErrInvalidID
	}
	var doc storedHold
	err := s.coll.FindOne(ctx, bson.D{{Key: "_id", Value: id}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Hold{}, ErrNotFound
	}
	if err != nil {
		return Hold{}, fmt.Errorf("load scam hold: %w", err)
	}
	return viewHold(doc), nil
}

func (s *Store) Put(ctx context.Context, hold Hold) error {
	id := strings.TrimSpace(hold.ID)
	if id == "" {
		return ErrInvalidID
	}
	doc := storedHold{
		ID:          id,
		JobID:       strings.TrimSpace(hold.JobID),
		ListingID:   strings.TrimSpace(hold.ListingID),
		Title:       hold.Title,
		Company:     hold.Company,
		CompanyID:   hold.CompanyID,
		ApplyURL:    hold.ApplyURL,
		Source:      hold.Source,
		Score:       hold.Score,
		Threshold:   hold.Threshold,
		Reasons:     hold.Reasons,
		Status:      hold.Status,
		Fingerprint: hold.Fingerprint,
		HeldAt:      hold.HeldAt.UTC(),
		ReviewedBy:  hold.ReviewedBy,
		ReviewNote:  hold.ReviewNote,
	}
	if doc.JobID == "" {
		doc.JobID = id
	}
	if doc.Reasons == nil {
		doc.Reasons = []Reason{}
	}
	if hold.ReviewedAt != nil && !hold.ReviewedAt.IsZero() {
		doc.ReviewedAt = hold.ReviewedAt.UTC()
	}
	_, err := s.coll.ReplaceOne(ctx, bson.D{{Key: "_id", Value: id}}, doc, options.Replace().SetUpsert(true))
	if err != nil {
		return fmt.Errorf("save scam hold: %w", err)
	}
	return nil
}

func (s *Store) List(ctx context.Context, query ListQuery) (List, error) {
	page, size := pageBounds(query.Page, query.PageSize)
	status := stringsOrHeld(query.Status)
	filter := bson.D{{Key: "status", Value: status}}
	total, err := s.coll.CountDocuments(ctx, filter)
	if err != nil {
		return List{}, fmt.Errorf("count scam holds: %w", err)
	}
	opts := options.Find().
		SetSkip((page - 1) * size).
		SetLimit(size).
		SetSort(bson.D{{Key: "heldAt", Value: -1}, {Key: "_id", Value: 1}})
	cursor, err := s.coll.Find(ctx, filter, opts)
	if err != nil {
		return List{}, fmt.Errorf("list scam holds: %w", err)
	}
	defer cursor.Close(ctx)
	var docs []storedHold
	if err := cursor.All(ctx, &docs); err != nil {
		return List{}, fmt.Errorf("decode scam holds: %w", err)
	}
	rows := make([]Hold, 0, len(docs))
	for _, doc := range docs {
		rows = append(rows, viewHold(doc))
	}
	return List{Jobs: rows, Total: total, Page: page, PageSize: size, Next: nextPage(page, size, total)}, nil
}

func (s *Store) CountFingerprint(ctx context.Context, fingerprint, exceptID string) (int, error) {
	fingerprint = strings.TrimSpace(fingerprint)
	if fingerprint == "" {
		return 0, nil
	}
	filter := bson.D{{Key: "fingerprint", Value: fingerprint}}
	if exceptID = strings.TrimSpace(exceptID); exceptID != "" {
		filter = append(filter, bson.E{Key: "_id", Value: bson.D{{Key: "$ne", Value: exceptID}}})
	}
	n, err := s.coll.CountDocuments(ctx, filter)
	if err != nil {
		return 0, fmt.Errorf("count scam fingerprints: %w", err)
	}
	return int(n), nil
}

func viewHold(doc storedHold) Hold {
	hold := Hold{
		ID:          doc.ID,
		JobID:       doc.JobID,
		ListingID:   doc.ListingID,
		Title:       doc.Title,
		Company:     doc.Company,
		CompanyID:   doc.CompanyID,
		ApplyURL:    doc.ApplyURL,
		Source:      doc.Source,
		Score:       doc.Score,
		Threshold:   doc.Threshold,
		Reasons:     doc.Reasons,
		Status:      doc.Status,
		Fingerprint: doc.Fingerprint,
		HeldAt:      doc.HeldAt,
		ReviewedBy:  doc.ReviewedBy,
		ReviewNote:  doc.ReviewNote,
	}
	if hold.Reasons == nil {
		hold.Reasons = []Reason{}
	}
	if !doc.ReviewedAt.IsZero() {
		at := doc.ReviewedAt
		hold.ReviewedAt = &at
	}
	return hold
}

var _ Holds = (*Store)(nil)
