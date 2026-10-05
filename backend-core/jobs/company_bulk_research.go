package jobs

import (
	"context"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// researchedAtField marks a company the bulk research has tried.
const researchedAtField = "research.at"

// ResearchScope picks the staged companies a bulk research works through.
type ResearchScope struct {
	// IDs are the staged companies to research, researched before or not.
	// Empty means every staged company the redo flag allows.
	IDs []string
	// Redo researches companies an earlier run already tried.
	Redo bool
	// WebSearch lets the model look the company up. Off, it answers without web_search.
	WebSearch bool
}

// ResearchCompanies researches staged companies on the web, workers at a time,
// busiest first, and publishes each one research finds. It only fills fields that are
// still blank, so admin edits stay. A company research cannot find stays staged as not
// found. Without redo it skips companies researched before. When it has worked through
// the list it looks again, so companies a copy stages meanwhile are researched too.
// A hand-picked set is researched once, including ones an earlier run already tried.
// A company that fails is reported and stays waiting; a missing API key stops the run.
func (s *Store) ResearchCompanies(ctx context.Context, researcher CompanyReader, model string, scope ResearchScope, workers int, progress Progress) error {
	if researcher == nil {
		return ErrMissingResearcher
	}
	progress = orNoProgress(progress)
	load := func(ctx context.Context, batch []string) ([]storedCompany, error) {
		docs, err := findAll[storedCompany](ctx, s.stagedCompanies(), bson.D{{Key: "id", Value: bson.D{{Key: "$in", Value: batch}}}})
		if err != nil {
			return nil, err
		}
		if missing := len(batch) - len(docs); missing > 0 {
			// Published since the run started, or never staged.
			progress.Skip(int64(missing))
		}
		return docs, nil
	}
	work := func(ctx context.Context, doc storedCompany) error {
		published, err := s.researchOne(ctx, researcher, model, doc, scope.WebSearch)
		switch {
		case err == nil && published:
			progress.Done(1)
		case err == nil:
			progress.Skip(1)
		case IsMissingAPIKey(err), errors.Is(err, ErrMissingResearcher), ctx.Err() != nil:
			return err
		default:
			progress.Fail(doc.ID, err)
		}
		return nil
	}

	if ids := selectedCompanyIDs(scope.IDs); len(ids) > 0 {
		progress.Total(int64(len(ids)))
		return runBulk(ctx, ids, workers, load, work)
	}

	seen := map[string]struct{}{}
	var total int64
	for {
		ids, err := s.stagedToResearch(ctx, scope.Redo, seen)
		if err != nil || len(ids) == 0 {
			return err
		}
		total += int64(len(ids))
		progress.Total(total)
		if err := runBulk(ctx, ids, workers, load, work); err != nil {
			return err
		}
	}
}

// selectedCompanyIDs keeps each non-blank id once, in the order given.
func selectedCompanyIDs(ids []string) []string {
	out := make([]string, 0, len(ids))
	seen := map[string]struct{}{}
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

// stagedToResearch lists staged company ids this run has not tried yet, busiest first.
// Without redo it leaves out companies an earlier run researched.
func (s *Store) stagedToResearch(ctx context.Context, redo bool, seen map[string]struct{}) ([]string, error) {
	filter := bson.D{}
	if !redo {
		filter = bson.D{{Key: researchedAtField, Value: bson.D{{Key: "$exists", Value: false}}}}
	}
	rows, err := findAll[struct {
		ID string `bson:"id"`
	}](ctx, s.stagedCompanies(), filter, options.Find().
		SetProjection(bson.D{{Key: "id", Value: 1}}).
		SetSort(bson.D{{Key: "jobCount", Value: -1}, {Key: "id", Value: 1}}))
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(rows))
	for _, row := range rows {
		if _, done := seen[row.ID]; done || row.ID == "" {
			continue
		}
		seen[row.ID] = struct{}{}
		ids = append(ids, row.ID)
	}
	return ids, nil
}

// researchOne researches one staged company and publishes it when research found it.
// A company research cannot find, or that has nothing to search for, is marked not
// found and stays staged.
func (s *Store) researchOne(ctx context.Context, researcher CompanyReader, model string, doc storedCompany, webSearch bool) (bool, error) {
	website := doc.displayURL()
	if !validLink(website, maxCompanyURL) {
		website = ""
	}
	found, err := researchCompany(ctx, researcher, doc.displayName(), website, webSearch)
	if err != nil && !errors.Is(err, ErrInvalidInput) {
		return false, err
	}
	filter := bson.D{{Key: "id", Value: doc.ID}}
	stamp := bson.D{
		{Key: researchedAtField, Value: time.Now().UTC()},
		{Key: "research.model", Value: model},
		{Key: "research.sources", Value: found.Sources},
	}
	if err != nil || !foundProfile(found.Company) {
		set := append(stamp, bson.E{Key: researchFoundField, Value: false})
		_, err := s.stagedCompanies().UpdateOne(ctx, filter, bson.D{{Key: "$set", Value: set}})
		return false, err
	}
	set := append(researchFill(doc, found.Company), stamp...)
	set = append(set, bson.E{Key: researchFoundField, Value: true})
	var researched bson.D
	err = s.stagedCompanies().FindOneAndUpdate(ctx, filter, bson.D{{Key: "$set", Value: set}},
		options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&researched)
	if errors.Is(err, mongo.ErrNoDocuments) {
		// Published meanwhile, by a scout picking it or another run.
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, s.publishStaged(ctx, researched)
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
