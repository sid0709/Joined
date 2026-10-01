package employer

import (
	"context"
	"errors"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	// maxOfficeLocations matches MAX_OFFICE_LOCATIONS in layer-a.ts.
	maxOfficeLocations = 40
	// maxOfficeLocation matches the free-text cap on Job.location.
	maxOfficeLocation = 120
)

func (s *Store) OfficeLocations(ctx context.Context, companyID string) (OfficeLocations, error) {
	stored, err := s.storedOfficeLocations(ctx, companyID)
	if err != nil {
		return OfficeLocations{}, err
	}
	return OfficeLocations{Locations: listOrEmpty(compactList(stored, maxOfficeLocations, maxOfficeLocation))}, nil
}

// SaveOfficeLocations replaces the picker catalog.
// Rename changes a catalog label only. It does not rewrite Job.location.
func (s *Store) SaveOfficeLocations(ctx context.Context, companyID string, input OfficeLocationsWrite) (OfficeLocations, error) {
	locations, err := normalizeOfficeLocations(input)
	if err != nil {
		return OfficeLocations{}, err
	}
	_, err = s.collection(officeLocationsCollection).UpdateOne(ctx, bson.D{{Key: "companyId", Value: companyID}}, bson.D{
		{Key: "$set", Value: storedOfficeLocations{CompanyID: companyID, Locations: locations}},
	}, options.UpdateOne().SetUpsert(true))
	if err != nil {
		return OfficeLocations{}, err
	}
	return OfficeLocations{Locations: listOrEmpty(locations)}, nil
}

func (s *Store) storedOfficeLocations(ctx context.Context, companyID string) ([]string, error) {
	var doc storedOfficeLocations
	err := s.collection(officeLocationsCollection).FindOne(ctx, bson.D{{Key: "companyId", Value: companyID}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return doc.Locations, nil
}

func normalizeOfficeLocations(input OfficeLocationsWrite) ([]string, error) {
	if input.Locations == nil {
		return nil, ErrInvalidInput
	}
	locations := compactList(input.Locations, maxOfficeLocations, maxOfficeLocation)
	if input.Rename == nil {
		return locations, nil
	}
	from := clip(input.Rename.From, maxOfficeLocation)
	to := clip(input.Rename.To, maxOfficeLocation)
	if from == "" || to == "" {
		return nil, ErrInvalidInput
	}
	return replaceLabel(locations, from, to, maxOfficeLocations, maxOfficeLocation), nil
}
