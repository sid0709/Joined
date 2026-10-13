package jobs

import (
	"context"
	"fmt"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// Match keys let ingest find the same job in temp_jobs or jobs with an indexed
// equality lookup: a job is the same when its canonical apply link matches, or
// when both its normalized company and normalized title match.
const (
	applyLinkKeyField = "applyLinkKey"
	companyKeyField   = "companyKey"
	titleKeyField     = "titleKey"
	matchKeysBatch    = 500
)

// matchKeySet is the $set fields that keep a row's match keys current.
func matchKeySet(company, title, applyLink string) bson.D {
	return bson.D{
		{Key: applyLinkKeyField, Value: CanonicalApplyURL(applyLink)},
		{Key: companyKeyField, Value: NormalizeCompany(company)},
		{Key: titleKeyField, Value: NormalizeTitle(title)},
	}
}

// withMatchKeys stamps the match keys a saved job is found by.
func (doc storedSearchJob) withMatchKeys() storedSearchJob {
	doc.ApplyLinkKey = CanonicalApplyURL(doc.ApplyLink)
	doc.CompanyKey = NormalizeCompany(doc.Job.Company)
	doc.TitleKey = NormalizeTitle(doc.Job.Title)
	return doc
}

// sameJobFilter matches a row with the same apply link, or the same company and
// title. Empty keys never match, so a blank field cannot pair unrelated jobs.
func sameJobFilter(applyKey, companyKey, titleKey string) bson.D {
	branches := bson.A{}
	if applyKey != "" {
		branches = append(branches, bson.D{{Key: applyLinkKeyField, Value: applyKey}})
	}
	if companyKey != "" && titleKey != "" {
		branches = append(branches, bson.D{
			{Key: companyKeyField, Value: companyKey},
			{Key: titleKeyField, Value: titleKey},
		})
	}
	if len(branches) == 0 {
		return nil
	}
	return bson.D{{Key: "$or", Value: branches}}
}

func matchKeyIndexes(timeField string) []mongo.IndexModel {
	return []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: applyLinkKeyField, Value: 1}, {Key: timeField, Value: -1}},
			Options: options.Index().SetName("match_apply_link_key"),
		},
		{
			Keys: bson.D{
				{Key: companyKeyField, Value: 1},
				{Key: titleKeyField, Value: 1},
				{Key: timeField, Value: -1},
			},
			Options: options.Index().SetName("match_company_title_key"),
		},
	}
}

// ensureMatchKeyIndexes indexes temp_jobs (by createdAt) and jobs (by postedAt)
// for the duplicate lookup. Creating an existing index is a no-op.
func (s *Store) ensureMatchKeyIndexes(ctx context.Context) error {
	for _, target := range []struct {
		coll      *mongo.Collection
		timeField string
	}{
		{s.dest(), "createdAt"},
		{s.structured(), "postedAt"},
	} {
		for _, model := range matchKeyIndexes(target.timeField) {
			if _, err := target.coll.Indexes().CreateOne(ctx, model); err != nil && !indexAlreadyExists(err) {
				return fmt.Errorf("ensure match key index: %w", err)
			}
		}
	}
	return nil
}

type matchKeySource struct {
	ID          bson.ObjectID `bson:"_id"`
	Title       string        `bson:"title"`
	CompanyName string        `bson:"companyName"`
	ApplyLink   string        `bson:"applyLink"`
	Job         struct {
		Title   string `bson:"title"`
		Company string `bson:"company"`
	} `bson:"job"`
}

// BackfillMatchKeys stamps match keys on temp_jobs and jobs rows saved before
// they existed. It is idempotent: rows that already have a titleKey are skipped.
func (s *Store) BackfillMatchKeys(ctx context.Context) (int64, error) {
	var total int64
	for _, target := range []struct {
		coll    *mongo.Collection
		fromJob bool
	}{
		{s.dest(), false},
		{s.structured(), true},
	} {
		updated, err := backfillMatchKeys(ctx, target.coll, target.fromJob)
		total += updated
		if err != nil {
			return total, err
		}
	}
	return total, nil
}

func backfillMatchKeys(ctx context.Context, coll *mongo.Collection, fromJob bool) (int64, error) {
	cursor, err := coll.Find(ctx,
		bson.D{{Key: titleKeyField, Value: bson.D{{Key: "$exists", Value: false}}}},
		options.Find().SetProjection(bson.D{
			{Key: "title", Value: 1},
			{Key: "companyName", Value: 1},
			{Key: "applyLink", Value: 1},
			{Key: "job.title", Value: 1},
			{Key: "job.company", Value: 1},
		}))
	if err != nil {
		return 0, fmt.Errorf("find rows without match keys: %w", err)
	}
	defer cursor.Close(ctx)

	var updated int64
	models := make([]mongo.WriteModel, 0, matchKeysBatch)
	flush := func() error {
		if len(models) == 0 {
			return nil
		}
		result, err := coll.BulkWrite(ctx, models, options.BulkWrite().SetOrdered(false))
		if err != nil {
			return fmt.Errorf("write match keys: %w", err)
		}
		updated += result.ModifiedCount
		models = models[:0]
		return nil
	}
	for cursor.Next(ctx) {
		var row matchKeySource
		if err := cursor.Decode(&row); err != nil {
			return updated, fmt.Errorf("decode row for match keys: %w", err)
		}
		company, title := row.CompanyName, row.Title
		if fromJob {
			company, title = row.Job.Company, row.Job.Title
		}
		models = append(models, mongo.NewUpdateOneModel().
			SetFilter(bson.D{{Key: "_id", Value: row.ID}}).
			SetUpdate(bson.D{{Key: "$set", Value: matchKeySet(company, title, row.ApplyLink)}}))
		if len(models) == matchKeysBatch {
			if err := flush(); err != nil {
				return updated, err
			}
		}
	}
	if err := cursor.Err(); err != nil {
		return updated, fmt.Errorf("read rows for match keys: %w", err)
	}
	return updated, flush()
}
