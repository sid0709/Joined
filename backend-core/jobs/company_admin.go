package jobs

import (
	"context"
	"errors"
	"strings"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

func (s *Store) GetAdminCompany(ctx context.Context, id string) (AdminCompany, error) {
	doc, err := s.storedCompanyByID(ctx, id)
	if err != nil {
		return AdminCompany{}, err
	}
	return doc.adminCompany(), nil
}

// UpdateCompany saves an admin edit and renames every public job for this company
// when the display name changes. Website and logo are read live from the company.
func (s *Store) UpdateCompany(ctx context.Context, id string, input CompanyWrite) (AdminCompany, error) {
	overrides, err := overridesFrom(input)
	if err != nil {
		return AdminCompany{}, err
	}
	doc, err := s.storedCompanyByID(ctx, id)
	if err != nil {
		return AdminCompany{}, err
	}
	previous := doc.displayName()
	update := bson.D{{Key: "$set", Value: bson.D{{Key: "overrides", Value: overrides}}}}
	logoChanged := strings.TrimSpace(input.Logo) != doc.displayLogo()
	if logoChanged {
		update = append(update, bson.E{Key: "$unset", Value: bson.D{{Key: "logoFile", Value: ""}}})
	}
	_, err = s.companies().UpdateOne(ctx, bson.D{{Key: "id", Value: doc.ID}}, update)
	if err != nil {
		return AdminCompany{}, err
	}
	doc.Overrides = overrides
	if logoChanged {
		doc.LogoFile = logoFile{}
	}
	if name := doc.displayName(); name != "" && name != previous {
		_, err = s.structured().UpdateMany(ctx, bson.D{{Key: "job.companyId", Value: doc.ID}}, bson.D{
			{Key: "$set", Value: bson.D{{Key: "job.company", Value: name}}},
		})
		if err != nil {
			return AdminCompany{}, err
		}
	}
	return doc.adminCompany(), nil
}

// fillMissingCompanyContact copies a job's website or logo onto the company
// only when that field is still empty, so a missed source value shows up publicly.
func (s *Store) fillMissingCompanyContact(ctx context.Context, source bson.ObjectID, url, logo string) error {
	url = strings.TrimSpace(url)
	logo = strings.TrimSpace(logo)
	if source.IsZero() || (url == "" && logo == "") {
		return nil
	}
	if url != "" && !validLink(url, maxCompanyURL) {
		url = ""
	}
	if logo != "" && !validLink(logo, maxCompanyLogo) {
		logo = ""
	}
	if url == "" && logo == "" {
		return nil
	}
	id, err := s.publicCompanyID(ctx, source)
	if err != nil || id == "" {
		return err
	}
	doc, err := s.storedCompanyByID(ctx, id)
	if err != nil {
		return err
	}
	set := bson.D{}
	if url != "" && doc.displayURL() == "" {
		set = append(set, bson.E{Key: "overrides.url", Value: url})
	}
	if logo != "" && doc.displayLogo() == "" {
		set = append(set, bson.E{Key: "overrides.logo", Value: logo})
	}
	if len(set) == 0 {
		return nil
	}
	_, err = s.companies().UpdateOne(ctx, bson.D{{Key: "id", Value: doc.ID}}, bson.D{
		{Key: "$set", Value: set},
	})
	return err
}

func (s *Store) storedCompanyByID(ctx context.Context, id string) (storedCompany, error) {
	if !isPublicID(id) {
		return storedCompany{}, ErrNotFound
	}
	var doc storedCompany
	err := s.companies().FindOne(ctx, bson.D{{Key: "id", Value: id}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return storedCompany{}, ErrNotFound
	}
	if err != nil {
		return storedCompany{}, err
	}
	return doc, nil
}

// DropCompanyLeadership removes the retired leadership list from every company profile.
func (s *Store) DropCompanyLeadership(ctx context.Context) (int64, error) {
	result, err := s.companies().UpdateMany(ctx, bson.D{
		{Key: "overrides.profile.leadership", Value: bson.D{{Key: "$exists", Value: true}}},
	}, bson.D{
		{Key: "$unset", Value: bson.D{{Key: "overrides.profile.leadership", Value: ""}}},
	})
	if err != nil {
		return 0, err
	}
	return result.ModifiedCount, nil
}
