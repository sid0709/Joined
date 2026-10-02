package jobs

import (
	"context"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// researchedAtField marks a company the bulk research has filled in.
const researchedAtField = "research.at"

// ResearchCompanies fills in company pages from the web, workers at a time, busiest
// companies first. It only fills fields that are still blank, so admin edits stay.
// Without redo it skips companies researched before. A company that fails is reported
// and stays unresearched for the next run; a missing API key stops the run.
func (s *Store) ResearchCompanies(ctx context.Context, researcher WebResearcher, model string, redo bool, workers int, progress Progress) error {
	if researcher == nil {
		return ErrMissingResearcher
	}
	progress = orNoProgress(progress)
	filter := bson.D{}
	if !redo {
		filter = bson.D{{Key: researchedAtField, Value: bson.D{{Key: "$exists", Value: false}}}}
	}
	rows, err := findAll[struct {
		ID string `bson:"id"`
	}](ctx, s.companies(), filter, options.Find().
		SetProjection(bson.D{{Key: "id", Value: 1}}).
		SetSort(bson.D{{Key: "jobCount", Value: -1}, {Key: "id", Value: 1}}))
	if err != nil {
		return err
	}
	ids := make([]string, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}
	progress.Total(int64(len(ids)))

	load := func(ctx context.Context, batch []string) ([]storedCompany, error) {
		return findAll[storedCompany](ctx, s.companies(), bson.D{{Key: "id", Value: bson.D{{Key: "$in", Value: batch}}}})
	}
	work := func(ctx context.Context, doc storedCompany) error {
		err := s.researchOne(ctx, researcher, model, doc)
		switch {
		case err == nil:
			progress.Done(1)
		case errors.Is(err, ErrInvalidInput):
			// No name and no usable website: nothing to search for.
			progress.Skip(1)
		case IsMissingAPIKey(err), errors.Is(err, ErrMissingResearcher), ctx.Err() != nil:
			return err
		default:
			progress.Fail(doc.ID, err)
		}
		return nil
	}
	return runBulk(ctx, ids, workers, load, work)
}

func (s *Store) researchOne(ctx context.Context, researcher WebResearcher, model string, doc storedCompany) error {
	website := doc.displayURL()
	if !validLink(website, maxCompanyURL) {
		website = ""
	}
	found, err := ResearchCompany(ctx, researcher, doc.displayName(), website)
	if err != nil {
		return err
	}
	set := researchFill(doc, found.Company)
	set = append(set,
		bson.E{Key: researchedAtField, Value: time.Now().UTC()},
		bson.E{Key: "research.model", Value: model},
		bson.E{Key: "research.sources", Value: found.Sources},
	)
	_, err = s.companies().UpdateOne(ctx, bson.D{{Key: "id", Value: doc.ID}}, bson.D{{Key: "$set", Value: set}})
	return err
}

// researchFill sets each researched field the company page still leaves blank.
func researchFill(doc storedCompany, found CompanyWrite) bson.D {
	set := bson.D{}
	fill := func(key string, blank bool, value any) {
		if blank {
			set = append(set, bson.E{Key: "overrides." + key, Value: value})
		}
	}
	text := func(key, current, value string) {
		fill(key, strings.TrimSpace(current) == "" && value != "", value)
	}
	profile := doc.Overrides.Profile
	text("url", doc.displayURL(), found.URL)
	text("profile.tagline", profile.Tagline, found.Tagline)
	text("profile.about", profile.About, found.About)
	text("profile.industry", profile.Industry, found.Industry)
	text("profile.size", profile.Size, found.Size)
	text("profile.headquarters", profile.Headquarters, found.Headquarters)
	text("profile.companyType", profile.CompanyType, found.CompanyType)
	text("profile.locations", profile.Locations, found.Locations)
	text("profile.mission", profile.Mission, found.Mission)
	fill("profile.founded", profile.Founded == 0 && found.Founded != 0, found.Founded)
	fill("profile.specialties", len(profile.Specialties) == 0 && len(found.Specialties) > 0, found.Specialties)
	fill("profile.values", len(profile.Values) == 0 && len(found.Values) > 0, found.Values)
	benefits := cleanBenefits(foldPerks(profile.BenefitCategories, profile.Perks))
	fill("profile.benefitCategories", len(benefits) == 0 && len(found.BenefitCategories) > 0, found.BenefitCategories)
	return set
}
