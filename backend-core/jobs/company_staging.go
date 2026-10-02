package jobs

import (
	"context"
	"errors"
	"fmt"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// Copied companies wait in temp_companies until research finds them on the web. Only
// then are they published to companies, where the directory and Joined show them. A
// company keeps its public id the whole way, so jobs link to it before it is published.

const (
	// stageBatch is how many companies one staging read or write handles.
	stageBatch = 500
	// researchFoundField says whether research found the company. A staged company
	// with research.at but not found waits for a retry or a person.
	researchFoundField = "research.found"
)

// CompanyRefs lists the public ids of companies other records point at, such as a
// recruiter's membership or a scout's submission. The copy never unpublishes those.
type CompanyRefs func(ctx context.Context) ([]string, error)

// SetCompanyRefs tells the company copy which companies other records point at.
func (s *Store) SetCompanyRefs(refs CompanyRefs) {
	s.companyRefs = refs
}

func (s *Store) stagedCompanies() *mongo.Collection {
	return s.client.Database(s.destDB).Collection(s.tempCompanies)
}

// untouchedCopy matches a source company the copy wrote straight to companies before
// staging existed, that nobody has touched since: never researched, edited, given a
// logo, claimed, verified, or owned.
func untouchedCopy() bson.D {
	absent := func(key string) bson.E {
		return bson.E{Key: key, Value: bson.D{{Key: "$exists", Value: false}}}
	}
	blank := func(key string) bson.E {
		return bson.E{Key: key, Value: bson.D{{Key: "$in", Value: bson.A{nil, ""}}}}
	}
	return bson.D{
		{Key: "sourceId", Value: bson.D{{Key: "$gt", Value: ""}}},
		absent(researchedAtField),
		absent("overrides"),
		absent("logoFile"),
		blank("verificationStatus"),
		blank("createdBy"),
		{Key: "claimed", Value: bson.D{{Key: "$ne", Value: true}}},
	}
}

// unstageUntouched moves untouched source companies out of companies into staging,
// unless another record points at them. It returns how many moved.
func (s *Store) unstageUntouched(ctx context.Context) (int64, error) {
	filter := untouchedCopy()
	if s.companyRefs != nil {
		refs, err := s.companyRefs(ctx)
		if err != nil {
			return 0, fmt.Errorf("list companies in use: %w", err)
		}
		if len(refs) > 0 {
			filter = append(filter, bson.E{Key: "id", Value: bson.D{{Key: "$nin", Value: refs}}})
		}
	}
	cursor, err := s.companies().Find(ctx, filter, options.Find().SetBatchSize(stageBatch))
	if err != nil {
		return 0, fmt.Errorf("read companies to stage: %w", err)
	}
	defer cursor.Close(ctx)

	var moved int64
	batch := make([]bson.D, 0, stageBatch)
	flush := func() error {
		if len(batch) == 0 {
			return nil
		}
		models := make([]mongo.WriteModel, len(batch))
		ids := make(bson.A, len(batch))
		for i, doc := range batch {
			models[i] = mongo.NewReplaceOneModel().
				SetFilter(bson.D{{Key: "sourceId", Value: stringField(doc, "sourceId")}}).
				SetReplacement(withoutID(doc)).
				SetUpsert(true)
			ids[i] = stringField(doc, "id")
		}
		// Staged before it leaves companies: a failure in between leaves a company in
		// both, and the next copy finishes the move.
		if _, err := s.stagedCompanies().BulkWrite(ctx, models, options.BulkWrite().SetOrdered(false)); err != nil {
			return fmt.Errorf("stage companies: %w", err)
		}
		// The filter again, so a company edited meanwhile stays published.
		removed, err := s.companies().DeleteMany(ctx, append(bson.D{{Key: "id", Value: bson.D{{Key: "$in", Value: ids}}}}, filter...))
		if err != nil {
			return fmt.Errorf("unpublish staged companies: %w", err)
		}
		moved += removed.DeletedCount
		batch = batch[:0]
		return nil
	}
	for cursor.Next(ctx) {
		var doc bson.D
		if err := cursor.Decode(&doc); err != nil {
			return moved, err
		}
		batch = append(batch, doc)
		if len(batch) == stageBatch {
			if err := flush(); err != nil {
				return moved, err
			}
		}
	}
	if err := cursor.Err(); err != nil {
		return moved, err
	}
	return moved, flush()
}

// dropPublishedFromStaging removes staged copies of companies that are already
// published, left behind by an interrupted move or a copy that ran beside research.
func (s *Store) dropPublishedFromStaging(ctx context.Context, published map[string]struct{}) error {
	sourceIDs := make([]string, 0, len(published))
	for id := range published {
		sourceIDs = append(sourceIDs, id)
	}
	for start := 0; start < len(sourceIDs); start += stageBatch {
		chunk := sourceIDs[start:min(start+stageBatch, len(sourceIDs))]
		_, err := s.stagedCompanies().DeleteMany(ctx, bson.D{{Key: "sourceId", Value: bson.D{{Key: "$in", Value: chunk}}}})
		if err != nil {
			return fmt.Errorf("clear published companies from staging: %w", err)
		}
	}
	return nil
}

// publishStaged moves a staged company into companies as it stands. A company that is
// already published stays as it is there, and its staged copy is dropped.
func (s *Store) publishStaged(ctx context.Context, doc bson.D) error {
	if _, err := s.companies().InsertOne(ctx, withoutID(doc)); err != nil && !mongo.IsDuplicateKeyError(err) {
		return fmt.Errorf("publish company: %w", err)
	}
	if _, err := s.stagedCompanies().DeleteOne(ctx, bson.D{{Key: "id", Value: stringField(doc, "id")}}); err != nil {
		return fmt.Errorf("clear published company from staging: %w", err)
	}
	return nil
}

// findCompanyOrStaged decodes the published company filter matches into out. When only
// a staged company matches, as when a scout picks one research has not reached yet,
// it is published first so nobody creates a second page for it.
func (s *Store) findCompanyOrStaged(ctx context.Context, filter bson.D, out any, opts ...options.Lister[options.FindOneOptions]) error {
	err := s.companies().FindOne(ctx, filter, opts...).Decode(out)
	if !errors.Is(err, mongo.ErrNoDocuments) {
		return err
	}
	var staged bson.D
	if err := s.stagedCompanies().FindOne(ctx, filter).Decode(&staged); err != nil {
		return err
	}
	if err := s.publishStaged(ctx, staged); err != nil {
		return err
	}
	return s.companies().FindOne(ctx, bson.D{{Key: "id", Value: stringField(staged, "id")}}, opts...).Decode(out)
}

// foundProfile reports whether research found the company: it described what the
// company does, its industry, or its size. A bare name and website is not enough to
// publish.
func foundProfile(company CompanyWrite) bool {
	return company.About != "" || company.Industry != "" || company.Size != ""
}

func withoutID(doc bson.D) bson.D {
	out := make(bson.D, 0, len(doc))
	for _, element := range doc {
		if element.Key != "_id" {
			out = append(out, element)
		}
	}
	return out
}

func stringField(doc bson.D, key string) string {
	for _, element := range doc {
		if element.Key == key {
			value, _ := element.Value.(string)
			return value
		}
	}
	return ""
}
