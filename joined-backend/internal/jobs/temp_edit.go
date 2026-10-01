package jobs

import (
	"context"
	"errors"
	"strings"
	"time"

	"encoding/json"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

const maxTempTitle = 200

// TempJobPatch is an admin correction of the scraped listing. Empty title or
// company is rejected. Other blanks are stored as given.
type TempJobPatch struct {
	Title       string `json:"title"`
	CompanyName string `json:"companyName"`
	CompanyLink string `json:"companyLink"`
	ApplyLink   string `json:"applyLink"`
	Description string `json:"description"`
	Location    string `json:"location"`
	Remote      string `json:"remote"`
	Seniority   string `json:"seniority"`
	Time        string `json:"time"`
	Salary      string `json:"salary"`
	CompanyLogo string `json:"companyLogo"`
}

func (s *Store) UpdateTempJob(ctx context.Context, idHex string, patch TempJobPatch, now time.Time) (json.RawMessage, error) {
	id, err := bson.ObjectIDFromHex(idHex)
	if err != nil {
		return nil, ErrInvalidID
	}
	patch, err = normalizeTempPatch(patch)
	if err != nil {
		return nil, err
	}
	result, err := s.dest().UpdateOne(ctx, bson.D{{Key: "_id", Value: id}}, bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "title", Value: patch.Title},
			{Key: "companyName", Value: patch.CompanyName},
			{Key: "companyLink", Value: patch.CompanyLink},
			{Key: "applyLink", Value: patch.ApplyLink},
			{Key: "description", Value: patch.Description},
			{Key: "metadata.companyLogo", Value: patch.CompanyLogo},
			{Key: "metadata.details.location", Value: patch.Location},
			{Key: "metadata.details.remote", Value: patch.Remote},
			{Key: "metadata.details.seniority", Value: patch.Seniority},
			{Key: "metadata.details.time", Value: patch.Time},
			{Key: "metadata.details.salary", Value: patch.Salary},
			{Key: "updatedAt", Value: now},
		}},
	})
	if err != nil {
		return nil, err
	}
	if result.MatchedCount == 0 {
		return nil, ErrNotFound
	}
	if err := s.syncSearchFromTemp(ctx, id, patch, now); err != nil {
		return nil, err
	}
	listing, err := s.tempListing(ctx, id)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return nil, err
	}
	if err == nil {
		if fillErr := s.fillMissingCompanyContact(ctx, listing.CompanyID, patch.CompanyLink, patch.CompanyLogo); fillErr != nil {
			return nil, fillErr
		}
	}
	return s.Get(ctx, idHex)
}

func (s *Store) syncSearchFromTemp(ctx context.Context, id bson.ObjectID, patch TempJobPatch, now time.Time) error {
	var doc storedSearchJob
	err := s.structured().FindOne(ctx, bson.D{{Key: "_id", Value: id}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil
	}
	if err != nil {
		return err
	}
	s.backfillDescription(ctx, &doc)
	doc.Job = applyTempFields(doc.Job, patch)
	if link := strings.TrimSpace(patch.ApplyLink); link != "" {
		doc.ApplyLink = link
	}
	doc.Job.PostedHoursAgo = hoursSince(doc.PostedAt, now)
	return s.saveSearchJob(ctx, doc)
}

func normalizeTempPatch(patch TempJobPatch) (TempJobPatch, error) {
	patch.Title = truncate(strings.TrimSpace(patch.Title), maxTempTitle)
	patch.CompanyName = truncate(strings.TrimSpace(patch.CompanyName), maxCompanyName)
	if patch.Title == "" || patch.CompanyName == "" {
		return TempJobPatch{}, ErrInvalidInput
	}
	patch.CompanyLink = strings.TrimSpace(patch.CompanyLink)
	patch.ApplyLink = strings.TrimSpace(patch.ApplyLink)
	patch.CompanyLogo = strings.TrimSpace(patch.CompanyLogo)
	patch.Description = truncate(strings.TrimSpace(patch.Description), maxDescriptionRunes)
	patch.Location = truncate(strings.TrimSpace(patch.Location), maxLocations)
	patch.Remote = truncate(strings.TrimSpace(patch.Remote), maxListItem)
	patch.Seniority = truncate(strings.TrimSpace(patch.Seniority), maxListItem)
	patch.Time = truncate(strings.TrimSpace(patch.Time), maxListItem)
	patch.Salary = truncate(strings.TrimSpace(patch.Salary), maxListItem)
	return patch, nil
}

// applyTempFields copies scraped fields an admin corrected onto the public job.
// Workplace, level, employment, and pay change only when the hint actually says something.
func applyTempFields(job SearchJob, patch TempJobPatch) SearchJob {
	job.Title = fallback(patch.Title, job.Title)
	job.Company = fallback(patch.CompanyName, job.Company)
	if description := strings.TrimSpace(patch.Description); description != "" {
		job.Description = description
	}
	if location := strings.TrimSpace(patch.Location); location != "" {
		job.Location = location
	}
	if remote := strings.TrimSpace(patch.Remote); remote != "" {
		job.Workplace = workplaceFromHint(remote)
	}
	if seniority := strings.TrimSpace(patch.Seniority); seniority != "" {
		job.Seniority = seniorityFromHint(seniority)
	}
	if employment := strings.TrimSpace(patch.Time); employment != "" {
		job.Employment = employmentFromHint(employment)
	}
	if hinted, ok := payFromHint(patch.Salary); ok {
		job.Pay = normalizePay(hinted, "")
	}
	return job
}
