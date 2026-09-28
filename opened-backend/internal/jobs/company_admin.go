package jobs

import (
	"context"
	"errors"
	"strings"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func (s *Store) ListCompanies(ctx context.Context, query ListQuery) (CompanyList, error) {
	coll := s.companies()
	filter := companyFilter(query.Q)
	total, err := coll.CountDocuments(ctx, filter)
	if err != nil {
		return CompanyList{}, err
	}
	opts := options.Find().
		SetSkip((query.Page - 1) * query.PageSize).
		SetLimit(query.PageSize).
		SetSort(bson.D{{Key: "companyName", Value: 1}, {Key: "id", Value: 1}}).
		SetProjection(bson.D{
			{Key: "id", Value: 1},
			{Key: "companyName", Value: 1},
			{Key: "companyUrl", Value: 1},
			{Key: "companyLogo", Value: 1},
			{Key: "jobCount", Value: 1},
			{Key: "overrides", Value: 1},
		})
	cursor, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return CompanyList{}, err
	}
	defer cursor.Close(ctx)

	var docs []storedCompany
	if err := cursor.All(ctx, &docs); err != nil {
		return CompanyList{}, err
	}
	companies := make([]CompanySummary, 0, len(docs))
	for _, doc := range docs {
		companies = append(companies, doc.summary())
	}
	return CompanyList{
		Companies: companies,
		Total:     total,
		Page:      query.Page,
		PageSize:  query.PageSize,
	}, nil
}

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
	_, err = s.companies().UpdateOne(ctx, bson.D{{Key: "id", Value: doc.ID}}, bson.D{
		{Key: "$set", Value: bson.D{{Key: "overrides", Value: overrides}}},
	})
	if err != nil {
		return AdminCompany{}, err
	}
	doc.Overrides = overrides
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

func companyFilter(q string) bson.D {
	pattern := searchPattern(q)
	if pattern == "" {
		return bson.D{}
	}
	regex := bson.D{{Key: "$regex", Value: pattern}, {Key: "$options", Value: "i"}}
	return bson.D{{Key: "$or", Value: bson.A{
		bson.D{{Key: "companyName", Value: regex}},
		bson.D{{Key: "overrides.name", Value: regex}},
		bson.D{{Key: "overrides.profile.industry", Value: regex}},
	}}}
}
