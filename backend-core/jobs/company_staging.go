package jobs

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// Staged companies wait in temp_companies until research finds them on the web. Only
// then are they published to companies, where the directory and Joined show them.

const (
	// stageBatch is how many companies one staging read or write handles.
	stageBatch = 500
	// researchFoundField says whether research found the company. A staged company
	// with research.at but not found waits for a retry or a person.
	researchFoundField = "research.found"
)

func (s *Store) stagedCompanies() *mongo.Collection {
	return s.client.Database(s.destDB).Collection(s.tempCompanies)
}

// dropPublishedFromStaging removes staged copies of companies that are already
// published. It returns how many it removed.
func (s *Store) dropPublishedFromStaging(ctx context.Context, published map[string]struct{}) (int64, error) {
	sourceIDs := make([]string, 0, len(published))
	for id := range published {
		sourceIDs = append(sourceIDs, id)
	}
	var dropped int64
	for start := 0; start < len(sourceIDs); start += stageBatch {
		chunk := sourceIDs[start:min(start+stageBatch, len(sourceIDs))]
		result, err := s.stagedCompanies().DeleteMany(ctx, bson.D{{Key: "sourceId", Value: bson.D{{Key: "$in", Value: chunk}}}})
		if err != nil {
			return dropped, fmt.Errorf("clear published companies from staging: %w", err)
		}
		dropped += result.DeletedCount
	}
	return dropped, nil
}

// publishStaged moves a staged company into companies as it stands. A company that is
// already published stays as it is there, and its staged copy is dropped.
func (s *Store) publishStaged(ctx context.Context, doc bson.D) error {
	if _, err := s.companies().InsertOne(ctx, withoutFields(doc, "_id")); err != nil && !mongo.IsDuplicateKeyError(err) {
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

func withoutFields(doc bson.D, keys ...string) bson.D {
	out := make(bson.D, 0, len(doc))
	for _, element := range doc {
		if !slices.Contains(keys, element.Key) {
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
