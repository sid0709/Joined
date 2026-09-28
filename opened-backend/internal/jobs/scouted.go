package jobs

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	// ScoutedSource marks search records that came from an approved scout submission.
	ScoutedSource  = "scoutwell"
	scoutedJobType = "scouted"
	scoutedModel   = "scout"
	tagVisa        = "visa"
)

// ScoutedListing is an approved scout submission, ready to publish.
type ScoutedListing struct {
	SubmissionID string
	ScoutUserID  string
	ApplyLink    string
	CompanyName  string
	// CompanyURL is the employer's own site, empty when the link is an ATS board.
	CompanyURL  string
	Title       string
	Location    string
	Workplace   string
	Employment  string
	Seniority   string
	SalaryText  string
	Summary     string
	Skills      []string
	Tags        []string
	SubmittedAt time.Time
}

// PublishedJob points at the search record a submission created.
type PublishedJob struct {
	ID        string
	Ref       string
	CompanyID string
}

var scoutSeniority = map[string]string{
	"entry":  seniorityJunior,
	"mid":    seniorityMiddle,
	"senior": senioritySenior,
}

// PublishScouted writes an approved scout job straight into the search pool.
// It never goes through temp_jobs: that collection is rebuilt by Copy.
func (s *Store) PublishScouted(ctx context.Context, listing ScoutedListing, now time.Time) (PublishedJob, error) {
	companyID, err := s.resolveScoutCompany(ctx, listing, now)
	if err != nil {
		return PublishedJob{}, err
	}
	publicID, err := newPublicID()
	if err != nil {
		return PublishedJob{}, err
	}
	pay := Pay{Currency: "USD", Period: payYear}
	if parsed, ok := ParsePayText(listing.SalaryText); ok {
		pay = parsed
	}
	doc := storedSearchJob{
		ID:         bson.NewObjectID(),
		PostedAt:   listing.SubmittedAt.UTC(),
		ApplyLink:  listing.ApplyLink,
		AnalyzedAt: now.UTC(),
		Model:      scoutedModel,
		CreatedBy:  listing.ScoutUserID,
		Source:     ScoutedSource,
		SourceRef:  listing.SubmissionID,
		Job: SearchJob{
			ID:               publicID,
			Title:            fallback(listing.Title, "Untitled"),
			Company:          fallback(listing.CompanyName, "Unknown company"),
			CompanyID:        companyID,
			Location:         fallback(listing.Location, "Location not listed"),
			Workplace:        oneOf(listing.Workplace, []string{workplaceRemote, workplaceHybrid, workplaceOnsite}, workplaceOnsite),
			Pay:              pay,
			Seniority:        fallback(scoutSeniority[listing.Seniority], seniorityMiddle),
			Employment:       oneOf(listing.Employment, []string{employmentFullTime, employmentContract, employmentPartTime}, employmentFullTime),
			Source:           scoutedJobType,
			Visa:             hasTag(listing.Tags, tagVisa),
			Skills:           cleanList(listing.Skills, maxSkills),
			Summary:          truncate(strings.TrimSpace(listing.Summary), maxSummaryRunes),
			Responsibilities: []string{},
			Requirements:     []string{},
			Benefits:         []string{},
		},
	}
	if err := s.saveSearchJob(ctx, doc); err != nil {
		return PublishedJob{}, err
	}
	return PublishedJob{ID: publicID, Ref: doc.ID.Hex(), CompanyID: companyID}, nil
}

// UnpublishScouted removes a scouted job from the search pool.
func (s *Store) UnpublishScouted(ctx context.Context, ref string) error {
	id, err := bson.ObjectIDFromHex(ref)
	if err != nil {
		return ErrInvalidID
	}
	_, err = s.structured().DeleteOne(ctx, bson.D{{Key: "_id", Value: id}, {Key: "source", Value: ScoutedSource}})
	return err
}

// JobWithApplyLink returns the public id of a live job whose apply link is one
// of links, or "" when none is.
func (s *Store) JobWithApplyLink(ctx context.Context, links []string) (string, error) {
	if len(links) == 0 {
		return "", nil
	}
	var doc struct {
		Job struct {
			ID string `bson:"id"`
		} `bson:"job"`
	}
	err := s.structured().FindOne(
		ctx,
		bson.D{{Key: "applyLink", Value: bson.D{{Key: "$in", Value: links}}}},
		options.FindOne().SetProjection(bson.D{{Key: "job.id", Value: 1}}),
	).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return doc.Job.ID, nil
}

// resolveScoutCompany matches the scout's company by key or name, and creates
// an unclaimed company page when the pool has never seen it (docs/14).
func (s *Store) resolveScoutCompany(ctx context.Context, listing ScoutedListing, now time.Time) (string, error) {
	key := companySlug(listing.CompanyName)
	var found struct {
		ID string `bson:"id"`
	}
	filter := bson.D{{Key: "$or", Value: bson.A{
		bson.D{{Key: "companyKey", Value: key}},
		bson.D{{Key: "companyName", Value: bson.D{
			{Key: "$regex", Value: "^" + regexp.QuoteMeta(strings.TrimSpace(listing.CompanyName)) + "$"},
			{Key: "$options", Value: "i"},
		}}},
	}}}
	err := s.companies().FindOne(ctx, filter, options.FindOne().SetProjection(bson.D{{Key: "id", Value: 1}})).Decode(&found)
	if err == nil && found.ID != "" {
		return found.ID, nil
	}
	if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
		return "", err
	}
	id, err := newPublicID()
	if err != nil {
		return "", err
	}
	_, err = s.companies().InsertOne(ctx, bson.D{
		{Key: "id", Value: id},
		{Key: "companyName", Value: strings.TrimSpace(listing.CompanyName)},
		{Key: "companyUrl", Value: listing.CompanyURL},
		{Key: "companyKey", Value: key},
		{Key: "companyLogo", Value: ""},
		{Key: "jobCount", Value: 0},
		{Key: "jobIds", Value: bson.A{}},
		{Key: "source", Value: ScoutedSource},
		{Key: "claimed", Value: false},
		{Key: "createdAt", Value: now.UTC()},
	})
	if err != nil {
		return "", err
	}
	return id, nil
}

func hasTag(tags []string, want string) bool {
	for _, tag := range tags {
		if strings.EqualFold(strings.TrimSpace(tag), want) {
			return true
		}
	}
	return false
}

// companySlug matches the companyKey written by auth when a company page is created.
func companySlug(name string) string {
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(strings.TrimSpace(name)) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
			dash = false
			continue
		}
		if !dash && b.Len() > 0 {
			b.WriteByte('-')
			dash = true
		}
	}
	return strings.Trim(b.String(), "-")
}
