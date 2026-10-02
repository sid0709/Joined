package jobs

import (
	"context"
	"errors"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/sid0709/OpenSeat/backend-core/jobschema"
	"github.com/sid0709/OpenSeat/backend-core/openai"
)

const (
	// ScoutedSource marks search records that came from an approved scout submission.
	ScoutedSource  = "scoutwell"
	scoutedJobType = "scouted"
	scoutedModel   = "scout"
)

// ScoutedListing is an approved scout submission, ready to publish.
type ScoutedListing struct {
	SubmissionID string
	ScoutUserID  string
	ApplyLink    string
	CompanyName  string
	// CompanyID is set when the scout picked or created a company page.
	CompanyID string
	// CompanyURL is the employer's own site, empty when the link is an ATS board.
	CompanyURL string
	Title      string
	Location   string
	Workplace  string
	Employment string
	Seniority  string
	Pay        Pay
	Equity     bool
	SalaryText string
	// Summary is the posting text as the scout wrote it. It is kept on the record
	// unchanged as the original job description; the model writes the listing
	// copy, skills, and visa flag from it.
	Summary     string
	SubmittedAt time.Time
}

// PublishedJob points at the search record a submission created.
type PublishedJob struct {
	ID        string
	Ref       string
	CompanyID string
}

const scoutTempCollection = "temp_scout_jobs"

func (s *Store) scoutTemp() *mongo.Collection {
	return s.client.Database(s.destDB).Collection(scoutTempCollection)
}

// StageScouted stores a scout submission for staff to analyze. Search does not
// show it until that analysis writes a record into the jobs collection.
func (s *Store) StageScouted(ctx context.Context, listing ScoutedListing, now time.Time) (string, error) {
	id := bson.NewObjectID()
	_, err := s.scoutTemp().InsertOne(ctx, bson.D{
		{Key: "_id", Value: id},
		{Key: "title", Value: listing.Title},
		{Key: "companyName", Value: listing.CompanyName},
		{Key: "description", Value: listing.Summary},
		{Key: "applyLink", Value: listing.ApplyLink},
		{Key: "postedAt", Value: listing.SubmittedAt.UTC()},
		{Key: "createdAt", Value: now.UTC()},
		{Key: "createdBy", Value: listing.ScoutUserID},
		{Key: "source", Value: ScoutedSource},
		{Key: "sourceRef", Value: listing.SubmissionID},
		{Key: "companyPublicId", Value: listing.CompanyID},
		{Key: "equity", Value: listing.Equity},
		{Key: "pay", Value: listing.Pay},
		{Key: "metadata", Value: bson.D{{Key: "details", Value: bson.D{
			{Key: "location", Value: listing.Location},
			{Key: "remote", Value: listing.Workplace},
			{Key: "seniority", Value: listing.Seniority},
			{Key: "time", Value: listing.Employment},
			{Key: "salary", Value: salaryHint(listing)},
		}}}},
	})
	if err != nil {
		return "", err
	}
	return id.Hex(), nil
}

// AnalyzeScouted screens for duplicates, then turns a scout submission into a
// search record. Scout-entered salary, location, and similar facts stay; the
// model writes the listing copy. continueExtract skips screening.
func (s *Store) AnalyzeScouted(ctx context.Context, reader ModelReader, listing ScoutedListing, tempJobID string, now time.Time, continueExtract bool) (AnalyzeScoutedResult, error) {
	if reader == nil {
		return AnalyzeScoutedResult{}, openai.ErrMissingAPIKey
	}
	var screened AnalyzeScoutedResult
	if !continueExtract {
		var err error
		screened, err = s.screenScouted(ctx, reader, listing)
		if err != nil {
			return AnalyzeScoutedResult{}, err
		}
		if screened.Duplicate != nil {
			return screened, nil
		}
	}
	id, err := bson.ObjectIDFromHex(tempJobID)
	if err != nil {
		id = bson.NewObjectID()
	}
	record, err := s.writeAnalysis(ctx, reader, listingFromScouted(listing, id), now)
	if err != nil {
		return AnalyzeScoutedResult{}, err
	}
	screened.Record = &record
	return screened, nil
}

func listingFromScouted(listing ScoutedListing, id bson.ObjectID) tempListing {
	doc := tempListing{
		ID:              id,
		Title:           listing.Title,
		CompanyName:     listing.CompanyName,
		Description:     listing.Summary,
		ApplyLink:       listing.ApplyLink,
		PostedAt:        listing.SubmittedAt.UTC(),
		CreatedBy:       listing.ScoutUserID,
		Source:          ScoutedSource,
		SourceRef:       listing.SubmissionID,
		CompanyPublicID: listing.CompanyID,
		Equity:          listing.Equity,
		Pay:             listing.Pay,
	}
	doc.Metadata.Details.Location = listing.Location
	doc.Metadata.Details.Remote = listing.Workplace
	doc.Metadata.Details.Seniority = listing.Seniority
	doc.Metadata.Details.Time = listing.Employment
	doc.Metadata.Details.Salary = salaryHint(listing)
	return doc
}

func salaryHint(listing ScoutedListing) string {
	if text := strings.TrimSpace(listing.SalaryText); text != "" {
		return text
	}
	if listing.Equity {
		return "equity"
	}
	if listing.Pay.Min == 0 && listing.Pay.Max == 0 {
		return ""
	}
	return strings.TrimSpace(strconv.Itoa(listing.Pay.Min) + "-" + strconv.Itoa(listing.Pay.Max) + " " + listing.Pay.Currency + " " + listing.Pay.Period)
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
	pay := Pay{Currency: jobschema.CurrencyUSD, Period: payYear}
	if !listing.Equity {
		if listing.Pay.Min != 0 || listing.Pay.Max != 0 {
			pay = normalizePay(extractedPay{
				Min:      float64(listing.Pay.Min),
				Max:      float64(listing.Pay.Max),
				Currency: listing.Pay.Currency,
				Period:   listing.Pay.Period,
			}, "")
		} else if parsed, ok := ParsePayText(listing.SalaryText); ok {
			pay = parsed
		}
	}
	seniority := seniorityMiddle
	if canonical, ok := jobschema.CanonicalSeniority(listing.Seniority); ok {
		seniority = canonical
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
			Title:            fallback(listing.Title, untitledJob),
			Company:          fallback(listing.CompanyName, unknownCompany),
			CompanyID:        companyID,
			Location:         fallback(listing.Location, locationNotListed),
			Workplace:        oneOf(listing.Workplace, []string{workplaceRemote, workplaceHybrid, workplaceOnsite}, workplaceOnsite),
			Pay:              pay,
			Equity:           listing.Equity,
			Seniority:        seniority,
			Employment:       oneOf(listing.Employment, []string{employmentFullTime, employmentContract, employmentPartTime}, employmentFullTime),
			Source:           scoutedJobType,
			Skills:           []string{},
			Summary:          truncate(strings.TrimSpace(listing.Summary), maxSummaryRunes),
			Description:      originalDescription(listing.Summary),
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

// DeleteScoutedBy removes every search job this scout published and returns
// their public ids so applications to those jobs can be removed too.
func (s *Store) DeleteScoutedBy(ctx context.Context, userID string) ([]string, error) {
	if _, err := s.scoutTemp().DeleteMany(ctx, bson.D{{Key: "createdBy", Value: userID}}); err != nil {
		return nil, err
	}
	return s.deleteSearchJobs(ctx, bson.D{
		{Key: "createdBy", Value: userID},
		{Key: "source", Value: ScoutedSource},
	})
}

// DeleteByCompany removes search jobs on a company page that is being deleted
// with the person who created it.
func (s *Store) DeleteByCompany(ctx context.Context, companyID string) ([]string, error) {
	if companyID == "" {
		return nil, nil
	}
	return s.deleteSearchJobs(ctx, bson.D{{Key: "job.companyId", Value: companyID}})
}

func (s *Store) deleteSearchJobs(ctx context.Context, filter bson.D) ([]string, error) {
	cursor, err := s.structured().Find(ctx, filter, options.Find().SetProjection(bson.D{{Key: "job.id", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var ids []string
	for cursor.Next(ctx) {
		var doc struct {
			Job struct {
				ID string `bson:"id"`
			} `bson:"job"`
		}
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		if doc.Job.ID != "" {
			ids = append(ids, doc.Job.ID)
		}
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	if _, err := s.structured().DeleteMany(ctx, filter); err != nil {
		return nil, err
	}
	return ids, nil
}

// CountCompanyJobs reports search jobs still attached to a company page.
func (s *Store) CountCompanyJobs(ctx context.Context, companyID string) (int64, error) {
	if companyID == "" {
		return 0, nil
	}
	return s.structured().CountDocuments(ctx, bson.D{{Key: "job.companyId", Value: companyID}})
}

// DeleteUnclaimedScoutCompany removes a company page a scout created, once
// nothing else still points at it. Catalog companies and recruiter-owned pages
// are left alone.
func (s *Store) DeleteUnclaimedScoutCompany(ctx context.Context, id string) error {
	if id == "" {
		return nil
	}
	_, err := s.companies().DeleteOne(ctx, bson.D{
		{Key: "id", Value: id},
		{Key: "source", Value: ScoutedSource},
		{Key: "$or", Value: bson.A{
			bson.D{{Key: "createdBy", Value: bson.D{{Key: "$exists", Value: false}}}},
			bson.D{{Key: "createdBy", Value: ""}},
		}},
	})
	return err
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

// resolveScoutCompany matches the scout's company by key or name, and creates
// an unclaimed company page when the pool has never seen it (docs/14).
func (s *Store) resolveScoutCompany(ctx context.Context, listing ScoutedListing, now time.Time) (string, error) {
	if id := strings.TrimSpace(listing.CompanyID); id != "" {
		var found struct {
			ID string `bson:"id"`
		}
		err := s.findCompanyOrStaged(ctx, bson.D{{Key: "id", Value: id}}, &found, options.FindOne().SetProjection(bson.D{{Key: "id", Value: 1}}))
		if err == nil && found.ID != "" {
			return found.ID, nil
		}
		if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
			return "", err
		}
	}
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
	err := s.findCompanyOrStaged(ctx, filter, &found, options.FindOne().SetProjection(bson.D{{Key: "id", Value: 1}}))
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
