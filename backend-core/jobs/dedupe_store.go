package jobs

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func listingSource(doc storedSearchJob) string {
	if strings.TrimSpace(doc.Source) != "" {
		return doc.Source
	}
	return doc.Job.Source
}

func recordFromStored(doc storedSearchJob) DedupeRecord {
	return DedupeRecord{
		ID:            doc.ID.Hex(),
		JobID:         doc.Job.ID,
		Company:       doc.Job.Company,
		CompanyID:     doc.Job.CompanyID,
		Title:         doc.Job.Title,
		Location:      doc.Job.Location,
		ApplyURL:      doc.ApplyLink,
		Source:        listingSource(doc),
		PostedAt:      doc.PostedAt,
		DedupeKey:     doc.DedupeKey,
		ListingStatus: doc.ListingStatus,
	}
}

func (s *Store) FindActiveByKey(ctx context.Context, key, exceptID string) (*DedupeRecord, error) {
	if key == "" {
		return nil, nil
	}
	filter := append(publicListingFilter(), bson.E{Key: "dedupeKey", Value: key})
	if oid, ok := objectIDExcept(exceptID); ok {
		filter = append(filter, bson.E{Key: "_id", Value: bson.D{{Key: "$ne", Value: oid}}})
	}
	var doc storedSearchJob
	err := s.structured().FindOne(ctx, filter).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find job by dedupe key: %w", err)
	}
	rec := recordFromStored(doc)
	return &rec, nil
}

func (s *Store) FindFuzzyCandidates(ctx context.Context, incoming DedupeRecord, exceptID string) ([]DedupeRecord, error) {
	cfg := DefaultDedupeConfig()
	filter := publicListingFilter()
	if incoming.CompanyID != "" {
		filter = append(filter, bson.E{Key: "job.companyId", Value: incoming.CompanyID})
	} else if name := NormalizeCompany(incoming.Company); name != "" {
		filter = append(filter, bson.E{Key: "job.company", Value: bson.D{
			{Key: "$regex", Value: "^" + regexp.QuoteMeta(name) + "$"},
			{Key: "$options", Value: "i"},
		}})
	} else {
		return nil, nil
	}
	if !incoming.PostedAt.IsZero() {
		filter = append(filter, bson.E{Key: "postedAt", Value: bson.D{
			{Key: "$gte", Value: incoming.PostedAt.Add(-cfg.PostedWithin)},
			{Key: "$lte", Value: incoming.PostedAt.Add(cfg.PostedWithin)},
		}})
	}
	if oid, ok := objectIDExcept(exceptID); ok {
		filter = append(filter, bson.E{Key: "_id", Value: bson.D{{Key: "$ne", Value: oid}}})
	}
	cursor, err := s.structured().Find(ctx, filter, options.Find().
		SetLimit(maxFuzzyCandidates).
		SetSort(bson.D{{Key: "postedAt", Value: -1}, {Key: "_id", Value: -1}}))
	if err != nil {
		return nil, fmt.Errorf("find fuzzy job candidates: %w", err)
	}
	defer cursor.Close(ctx)
	var docs []storedSearchJob
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decode fuzzy job candidates: %w", err)
	}
	out := make([]DedupeRecord, 0, len(docs))
	for _, doc := range docs {
		out = append(out, recordFromStored(doc))
	}
	return out, nil
}

func objectIDExcept(id string) (bson.ObjectID, bool) {
	if id == "" {
		return bson.ObjectID{}, false
	}
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil || oid.IsZero() {
		return bson.ObjectID{}, false
	}
	return oid, true
}

func (s *Store) upsertDeduped(ctx context.Context, doc storedSearchJob) error {
	save, skip, err := s.dedupeSave(ctx, doc)
	if err != nil {
		return err
	}
	if skip {
		return nil
	}
	_, err = s.structured().ReplaceOne(
		ctx,
		bson.D{{Key: "_id", Value: save.ID}},
		save,
		options.Replace().SetUpsert(true),
	)
	if err == nil || !mongo.IsDuplicateKeyError(err) {
		return err
	}
	save, skip, err = s.dedupeSave(ctx, doc)
	if err != nil {
		return err
	}
	if skip {
		return nil
	}
	_, err = s.structured().ReplaceOne(
		ctx,
		bson.D{{Key: "_id", Value: save.ID}},
		save,
		options.Replace().SetUpsert(true),
	)
	return err
}

func (s *Store) dedupeSave(ctx context.Context, doc storedSearchJob) (storedSearchJob, bool, error) {
	doc.DedupeKey = DedupeKey(doc.Job.Company, doc.Job.Title, doc.Job.Location, doc.ApplyLink)
	plan, err := PlanDedupeWrite(ctx, DefaultDedupeConfig(), s, recordFromStored(doc))
	if err != nil {
		return storedSearchJob{}, false, fmt.Errorf("plan job dedupe: %w", err)
	}
	switch plan.Action {
	case dedupeActionSkip:
		return storedSearchJob{}, true, nil
	case dedupeActionReplace:
		oid, err := bson.ObjectIDFromHex(plan.Save.ID)
		if err != nil {
			return storedSearchJob{}, false, fmt.Errorf("surviving job id: %w", err)
		}
		doc.ID = oid
		if plan.Save.JobID != "" {
			doc.Job.ID = plan.Save.JobID
		}
		if !plan.Save.PostedAt.IsZero() {
			doc.PostedAt = plan.Save.PostedAt
		}
		doc.DedupeKey = plan.Save.DedupeKey
		return doc, false, nil
	default:
		return doc, false, nil
	}
}

// ReportDuplicateGroups lists exact and fuzzy duplicate clusters without writing.
func (s *Store) ReportDuplicateGroups(ctx context.Context, cfg DedupeConfig) ([]DuplicateGroup, error) {
	cfg = cfg.withDefaults()
	cursor, err := s.structured().Find(ctx, publicListingFilter(), options.Find().SetProjection(bson.D{
		{Key: "_id", Value: 1},
		{Key: "job", Value: 1},
		{Key: "applyLink", Value: 1},
		{Key: "source", Value: 1},
		{Key: "postedAt", Value: 1},
		{Key: "listingStatus", Value: 1},
		{Key: "dedupeKey", Value: 1},
	}))
	if err != nil {
		return nil, fmt.Errorf("list jobs for dedupe dry-run: %w", err)
	}
	defer cursor.Close(ctx)
	var docs []storedSearchJob
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decode jobs for dedupe dry-run: %w", err)
	}
	records := make([]DedupeRecord, 0, len(docs))
	for _, doc := range docs {
		records = append(records, recordFromStored(doc))
	}
	return DuplicateGroups(records, cfg), nil
}
