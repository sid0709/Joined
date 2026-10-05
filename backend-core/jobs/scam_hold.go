package jobs

import (
	"context"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobscam"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type scamHoldAPI interface {
	Inspect(ctx context.Context, in jobscam.Input, now time.Time) (jobscam.Decision, error)
}

// SetScamHolds wires the publish-time scam gate. Nil leaves listings unchanged.
func (s *Store) SetScamHolds(api jobscam.API) {
	if s == nil {
		return
	}
	s.scamHolds = api
}

func (s *Store) applyScamHold(ctx context.Context, doc storedSearchJob) (storedSearchJob, error) {
	if s == nil || s.scamHolds == nil {
		return doc, nil
	}
	in := jobscam.Input{
		JobID:       strings.TrimSpace(doc.Job.ID),
		ListingID:   doc.ID.Hex(),
		Title:       doc.Job.Title,
		Company:     doc.Job.Company,
		CompanyID:   doc.Job.CompanyID,
		CompanyURL:  s.companyWebsite(ctx, doc.Job.CompanyID),
		ApplyURL:    doc.ApplyLink,
		Description: doc.Job.Description,
		Summary:     doc.Job.Summary,
		Seniority:   doc.Job.Seniority,
		PayMin:      doc.Job.Pay.Min,
		PayMax:      doc.Job.Pay.Max,
		PayPeriod:   doc.Job.Pay.Period,
		Source:      fallback(doc.Source, doc.Job.Source),
	}
	decision, err := s.scamHolds.Inspect(ctx, in, doc.AnalyzedAt)
	if err != nil {
		return storedSearchJob{}, err
	}
	switch {
	case decision.Remove:
		doc.PreviousListingStatus = doc.ListingStatus
		doc.ListingStatus = ListingRemoved
	case decision.Hold && ListingPublic(doc.ListingStatus):
		doc.PreviousListingStatus = doc.ListingStatus
		doc.ListingStatus = ListingPendingReview
	}
	return doc, nil
}

// SetScamHoldStatus is what staff review writes onto the public search row.
func (s *Store) SetScamHoldStatus(ctx context.Context, jobID, status string) error {
	if s == nil || s.client == nil {
		return nil
	}
	filter, err := searchIDFilter(jobID)
	if err != nil {
		return err
	}
	result, err := s.structured().UpdateOne(ctx, filter, bson.D{{Key: "$set", Value: bson.D{
		{Key: "listingStatus", Value: status},
	}}})
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return jobscam.ErrNotFound
	}
	return nil
}

func (s *Store) companyWebsite(ctx context.Context, companyID string) string {
	if s == nil || s.client == nil || strings.TrimSpace(companyID) == "" {
		return ""
	}
	var doc storedCompany
	err := s.companies().FindOne(ctx, bson.D{{Key: "id", Value: companyID}}, options.FindOne().SetProjection(bson.D{
		{Key: "companyUrl", Value: 1},
		{Key: "overrides.url", Value: 1},
	})).Decode(&doc)
	if err != nil {
		return ""
	}
	return doc.displayURL()
}
